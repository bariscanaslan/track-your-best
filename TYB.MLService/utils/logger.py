"""Logging configuration for TYB.MLService."""

import json
import logging
from datetime import datetime


class JsonFormatter(logging.Formatter):
    """JSON log formatter."""

    def format(self, record: logging.LogRecord) -> str:
        log_dict = {
            "timestamp": datetime.utcnow().isoformat(),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
            "module": record.module,
            "function": record.funcName,
            "line": record.lineno,
        }

        if record.exc_info:
            log_dict["exception"] = self.formatException(record.exc_info)

        return json.dumps(log_dict, ensure_ascii=False)


def setup_logging(log_level: str = "INFO", use_json: bool = True):
    """Configure root logging."""
    root_logger = logging.getLogger()
    root_logger.setLevel(getattr(logging, log_level))

    console_handler = logging.StreamHandler()
    console_handler.setLevel(getattr(logging, log_level))

    if use_json:
        formatter = JsonFormatter()
    else:
        formatter = logging.Formatter(
            "%(asctime)s - %(name)s - %(levelname)s - %(message)s"
        )

    console_handler.setFormatter(formatter)
    root_logger.handlers.clear()
    root_logger.addHandler(console_handler)

    return root_logger
