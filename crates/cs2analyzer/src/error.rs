use thiserror::Error;

/// Errors from parsing a demo file.
#[derive(Debug, Error)]
pub enum ParseError {
    #[error("failed to parse demo: {0}")]
    Demo(String),
    #[error("{0}")]
    Message(String),
}
