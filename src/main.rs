use anyhow::{bail, Context, Result};
use clap::{Parser, Subcommand};
use how_to_mcd::{mcp, pantry, recipes, web};

#[derive(Debug, Parser)]
#[command(name = "how-to-mcd", version, about = "麦麦灵感，家里开做！Rust MCP & community cooking recipes")]
struct Cli {
    #[command(subcommand)]
    command: Command,
}

#[derive(Debug, Subcommand)]
enum Command {
    /// List available community recipes
    Recipes,
    /// Render a recipe for the chosen number of servings
    Show {
        id: String,
        #[arg(long)]
        servings: Option<u32>,
    },
    /// Validate the complete recipe collection
    Validate,
    /// Suggest home recipes based on ingredients currently in the kitchen
    Suggest {
        #[arg(long)]
        ingredients: String,
    },
    /// Start the browser-based kitchen workbench (loopback only by default)
    Serve {
        #[arg(long, default_value = "127.0.0.1")]
        host: String,
        #[arg(long, default_value_t = 3000)]
        port: u16,
    },
    /// Read-only McDonald's China MCP operations (requires MCD_MCP_TOKEN)
    Mcp {
        #[command(subcommand)]
        command: McpCommand,
    },
}

#[derive(Debug, Subcommand)]
enum McpCommand {
    /// Discover supported MCP tool names (does not call any business tool)
    Tools,
    /// Call the official nutrition list tool with no arguments
    Nutrition,
    /// Call only approved read-only tools, using documented JSON arguments
    Call {
        tool: String,
        #[arg(long, default_value = "{}")]
        args: String,
    },
}

#[tokio::main]
async fn main() -> Result<()> {
    let cli = Cli::parse();
    match cli.command {
        Command::Recipes => {
            for recipe in recipes::all()? {
                println!("{} — {} ({} 人份)", recipe.id, recipe.name, recipe.servings);
            }
        }
        Command::Show { id, servings } => {
            let recipe = recipes::by_id(&id)?.with_context(|| format!("recipe not found: {id}"))?;
            let servings = servings.unwrap_or(recipe.servings);
            if servings == 0 || servings > 100 {
                bail!("servings must be between 1 and 100");
            }
            println!("{}", recipe.render(servings));
        }
        Command::Suggest { ingredients } => {
            for entry in pantry::suggest(&ingredients)? {
                println!("{} — {}% 已具备 {}/{} 项；还需：{}",
                    entry.name, entry.score_percent, entry.matched_count,
                    entry.total_count, entry.missing.join("、"));
            }
        }
        Command::Validate => {
            let recipes = recipes::all()?;
            println!("Validated {} community recipes.", recipes.len());
        }
        Command::Serve { host, port } => web::serve(&host, port).await?,
        Command::Mcp { command } => {
            // Never log the token, auth headers, or raw network error details.
            let token = std::env::var("MCD_MCP_TOKEN")
                .context("MCD_MCP_TOKEN is not configured; set it as an environment variable")?;
            if token.trim().is_empty() {
                bail!("MCD_MCP_TOKEN must not be empty");
            }
            let result = match command {
                McpCommand::Tools => mcp::discover(&token).await,
                McpCommand::Nutrition => mcp::call(&token, "list-nutrition-foods", serde_json::json!({})).await,
                McpCommand::Call { tool, args } => {
                    let input: serde_json::Value = serde_json::from_str(&args)
                        .context("--args must be valid JSON")?;
                    mcp::call(&token, &tool, input).await
                }
            };
            match result {
                Ok(value) => println!("{}", serde_json::to_string_pretty(&value)?),
                Err(_) => bail!("MCP request failed; check Token, connectivity, tool arguments and server availability (sensitive details suppressed)"),
            }
        }
    }
    Ok(())
}
