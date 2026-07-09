import logging


def configure_logging(level: str) -> None:
    """Configure a minimal structured-friendly logging baseline."""
    logging.basicConfig(
        level=level.upper(),
        format="%(asctime)s %(levelname)s %(name)s %(message)s",
    )

