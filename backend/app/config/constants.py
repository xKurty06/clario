APP_DISPLAY_NAME = "Procurement Validator"
APP_PACKAGE_NAME = "procurement-validator"
APP_VERSION = "0.1.0"
API_PREFIX = "/api/v1"
SUPPORTED_FILE_EXTENSIONS = frozenset({".xlsx", ".xls", ".csv"})
MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024
MAX_FILES_PER_SESSION = 10
DEFAULT_IGNORED_TERMS = (
    "total", "subtotal", "grand total", "signature", "prepared by", "bidder",
    "page", "terms", "delivery", "payment",
)
