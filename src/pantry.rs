//! A deterministic, explainable pantry-to-recipe matcher.
//!
//! AI can extract food names from natural language. Rust does the actual
//! matching and makes every recommendation auditable and reproducible.
use anyhow::{bail, Result};
use serde::Serialize;

use crate::recipes::{self, Ingredient};

#[derive(Debug, Clone, Serialize)]
pub struct Suggestion {
    pub id: String,
    pub name: String,
    pub score_percent: u32,
    pub matched_count: usize,
    pub total_count: usize,
    pub available: Vec<String>,
    pub missing: Vec<String>,
}

fn normalize(value: &str) -> String {
    value.trim().to_lowercase().chars()
        .filter(|c| !c.is_whitespace() && !matches!(c, '(' | ')' | '（' | '）' | '-' | '_'))
        .collect()
}

fn aliases(ingredient: &str) -> &'static [&'static str] {
    match ingredient {
        "去骨鸡腿肉" => &["鸡腿肉", "鸡腿", "鸡肉"],
        "鸡胸肉" => &["鸡胸", "鸡肉"],
        "汉堡胚" => &["汉堡面包", "面包胚", "面包"],
        "食用油" => &["植物油", "橄榄油", "玉米油", "花生油"],
        "面包糠" => &["面包屑", "裹粉"],
        "土豆" => &["马铃薯", "洋芋"],
        "鸡蛋" => &["蛋"],
        "蛋黄酱" => &["沙拉酱", "美乃滋"],
        "甜椒粉（可选）" => &["甜椒粉", "辣椒粉"],
        "酱油" => &["生抽"],
        "面粉" => &["小麦粉"],
        _ => &[],
    }
}

fn matches(item: &Ingredient, pantry: &[String]) -> bool {
    let canonical = normalize(&item.name);
    let alternatives = aliases(&item.name);
    pantry.iter().any(|token| {
        if token.chars().count() < 2 {
            return false;
        }
        canonical == *token
            || canonical.contains(token)
            || token.contains(&canonical)
            || alternatives.iter().any(|alias| {
                let alias = normalize(alias);
                alias == *token || alias.contains(token) || token.contains(&alias)
            })
    })
}

pub fn suggest(ingredients: &str) -> Result<Vec<Suggestion>> {
    if ingredients.len() > 512 {
        bail!("The ingredient list is too long (max 512 UTF-8 bytes)");
    }
    let pantry: Vec<_> = ingredients
        .split(|c: char| matches!(c, ',' | '，' | '、' | '；' | ';' | '/' | '\n' | ' '))
        .map(normalize)
        .filter(|s| !s.is_empty())
        .take(31)
        .collect();
    if pantry.is_empty() || pantry.len() > 30 {
        bail!("Provide 1 to 30 comma-separated ingredients");
    }

    let mut suggestions: Vec<Suggestion> = recipes::all()?.into_iter().map(|recipe| {
        let mut available = Vec::new();
        let mut missing = Vec::new();
        for ingredient in &recipe.ingredients {
            if matches(ingredient, &pantry) {
                available.push(ingredient.name.clone());
            } else {
                missing.push(ingredient.name.clone());
            }
        }
        let matched_count = available.len();
        let total_count = recipe.ingredients.len();
        let score_percent = (matched_count * 100 / total_count) as u32;
        Suggestion {
            id: recipe.id, name: recipe.name, score_percent,
            matched_count, total_count, available, missing,
        }
    }).collect();

    suggestions.sort_by(|a, b| b.score_percent.cmp(&a.score_percent)
        .then(b.matched_count.cmp(&a.matched_count))
        .then(a.id.cmp(&b.id)));
    Ok(suggestions)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn matching_pantry_ranks_chicken_burger_first() {
        let matches = suggest("鸡腿、面包、生菜").unwrap();
        assert_eq!(matches[0].id, "chicken-burger");
        assert!(matches[0].matched_count >= 3);
        assert!(matches[0].missing.iter().any(|x| x == "蛋黄酱"));
    }

    #[test]
    fn potato_alias_recommends_fries() {
        let matches = suggest("洋芋, 盐, 橄榄油").unwrap();
        assert_eq!(matches[0].id, "crispy-fries");
        assert_eq!(matches[0].matched_count, 3);
    }

    #[test]
    fn rejects_empty_and_huge_pantry() {
        assert!(suggest(" ， 、 ").is_err());
        assert!(suggest(&"土豆".repeat(200)).is_err());
    }

    #[test]
    fn scoring_is_reproducible() {
        let a = suggest("鸡蛋、面粉、面包糠").unwrap();
        let b = suggest("鸡蛋、面粉、面包糠").unwrap();
        assert_eq!(a[0].id, b[0].id);
        assert_eq!(a[0].score_percent, b[0].score_percent);
    }
}
