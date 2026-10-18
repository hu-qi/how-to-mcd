//! Dedicated, stateless public MCP bridge. The browser supplies its own
//! personal token per request; no repository secret is ever used for visitors.
use tower::ServiceBuilder;
use vercel_runtime::{axum::VercelLayer, Error};

#[tokio::main]
async fn main() -> Result<(), Error> {
    let router = how_to_mcd::web::public_api_app();
    let app = ServiceBuilder::new()
        .layer(VercelLayer::new())
        .service(router);
    vercel_runtime::run(app).await
}
