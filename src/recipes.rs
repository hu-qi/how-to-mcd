use anyhow::{bail, Context, Result};
use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, Deserialize, Serialize)]
pub struct Ingredient {
    pub name: String,
    pub amount: f64,
    pub unit: String,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
pub struct Recipe {
    pub id: String,
    pub name: String,
    pub summary: String,
    pub servings: u32,
    pub minutes: u32,
    pub equipment: Vec<String>,
    pub ingredients: Vec<Ingredient>,
    pub steps: Vec<String>,
    pub allergens: Vec<String>,
    pub safety: Vec<String>,
    pub attribution: String,
}

const SOURCES: [(&str, &str); 3] = [
    ("chicken-burger", include_str!("../recipes/chicken-burger.json")),
    ("crispy-fries", include_str!("../recipes/crispy-fries.json")),
    ("chicken-nuggets", include_str!("../recipes/chicken-nuggets.json")),
];

impl Recipe {
    pub fn validate(&self) -> Result<()> {
        if self.id.trim().is_empty() || self.name.trim().is_empty() || self.summary.trim().is_empty() {
            bail!("recipe identity and description cannot be empty");
        }
        if self.servings == 0 || self.servings > 100 || self.minutes == 0 {
            bail!("recipe servings or preparation minutes out of range");
        }
        if self.ingredients.is_empty() || self.steps.is_empty() || self.safety.is_empty() {
            bail!("recipe must include ingredients, steps and food safety guidance");
        }
        for i in &self.ingredients {
            if i.name.trim().is_empty() || i.unit.trim().is_empty() || !i.amount.is_finite() || i.amount <= 0.0 {
                bail!("invalid ingredient in recipe {}", self.id);
            }
        }
        if !self.attribution.contains("社区原创") {
            bail!("recipe must state independent community creation");
        }
        Ok(())
    }

    pub fn render(&self, servings: u32) -> String {
        let ratio = servings as f64 / self.servings as f64;
        let mut lines = vec![
            format!("# {} | {} 人份", self.name, servings),
            self.summary.clone(),
            format!("预计用时：{} 分钟", self.minutes),
            format!("厨具：{}", self.equipment.join("、")),
            String::from("\n## 食材"),
        ];
        for item in &self.ingredients {
            let amount = item.amount * ratio;
            let formatted = if (amount - amount.round()).abs() < 1e-8 {
                format!("{amount:.0}")
            } else {
                format!("{amount:.1}")
            };
            lines.push(format!("- {}：{} {}", item.name, formatted, item.unit));
        }
        lines.push(String::from("\n## 步骤"));
        for (idx, step) in self.steps.iter().enumerate() {
            lines.push(format!("{}. {}", idx + 1, step));
        }
        lines.push(format!("\n过敏原提醒：{}", self.allergens.join("、")));
        lines.push(format!("食品安全：{}", self.safety.join("；")));
        lines.push(self.attribution.clone());
        lines.join("\n")
    }
}

pub fn all() -> Result<Vec<Recipe>> {
    let mut recipes = Vec::new();
    for (id, content) in SOURCES {
        let recipe: Recipe = serde_json::from_str(content).with_context(|| format!("invalid JSON for {id}"))?;
        recipe.validate()?;
        if recipe.id != id {
            bail!("recipe filename and id mismatch: {id}");
        }
        recipes.push(recipe);
    }
    Ok(recipes)
}

pub fn by_id(id: &str) -> Result<Option<Recipe>> {
    Ok(all()?.into_iter().find(|r| r.id == id))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn validates_all_recipes() {
        let found = all().expect("valid recipes");
        assert_eq!(found.len(), 3);
    }

    #[test]
    fn scaling_works() {
        let recipe = by_id("chicken-burger").unwrap().unwrap();
        let output = recipe.render(4);
        assert!(output.contains("600 g"), "{output}");
    }

    #[test]
    fn rejects_invalid_amounts() {
        let mut recipe = by_id("crispy-fries").unwrap().unwrap();
        recipe.ingredients[0].amount = f64::NAN;
        assert!(recipe.validate().is_err());
    }

    #[test]
    fn recipe_is_not_official_formula() {
        for recipe in all().unwrap() {
            assert!(recipe.attribution.contains("社区原创"));
        }
    }
}
