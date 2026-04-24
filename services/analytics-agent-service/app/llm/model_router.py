from app.config import settings


class ModelRouter:
    @staticmethod
    def for_parse_intent() -> str:
        return settings.GOOGLE_LARGE_MODEL

    @staticmethod
    def for_build_analysis_plan() -> str:
        return settings.GOOGLE_LARGE_MODEL

    @staticmethod
    def for_generate_sql() -> str:
        return settings.GOOGLE_SMALL_MODEL

    @staticmethod
    def for_analyze() -> str:
        return settings.GOOGLE_LARGE_MODEL

    @staticmethod
    def for_lightweight_repair() -> str:
        return settings.GOOGLE_SMALL_MODEL
