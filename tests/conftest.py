import pytest
from fastapi.testclient import TestClient
from fastapi import Request
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from main import app
from database import get_db
import db_models
import auth
from auth import TokenData, MOCK_USERS_DB
import logic

# 1. Set up an in-memory SQLite database for test isolation
SQLALCHEMY_DATABASE_URL = "sqlite:///:memory:"

# Use StaticPool to ensure the memory database persists across multiple connections
engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


@pytest.fixture(scope="function")
def db_session():
    """Create and destroy database tables for each test to ensure data isolation."""
    db_models.Base.metadata.create_all(bind=engine)
    db = TestingSessionLocal()

    # Initialize baseline weights for the Medical Logic Engine
    logic.MedicalLogicEngine.initialize_floors(db)

    try:
        yield db
    finally:
        db.close()
        db_models.Base.metadata.drop_all(bind=engine)


@pytest.fixture(scope="function")
def client(db_session):
    """Provides a TestClient fixture with overridden database and authentication dependencies."""

    # Override get_db to point to the isolated memory database
    def override_get_db():
        try:
            yield db_session
        finally:
            pass

    # Override get_current_user to allow dynamic role switching without requiring real JWTs
    def override_get_current_user(request: Request):
        # Intercept the custom role header from test requests
        role_header = request.headers.get("x-user-role", "clinician")

        # Map simple role names to valid mock user entities
        role_map = {
            "clinician": MOCK_USERS_DB["dr_smith"],         # Clinic A
            "staff": MOCK_USERS_DB["nurse_joy"],            # Clinic A
            "patient": MOCK_USERS_DB["patient_123"],        # Clinic A
            "admin": MOCK_USERS_DB["admin_alice"],          # Clinic A
            "foreign_clinician": MOCK_USERS_DB["dr_jones"]  # Clinic B (for isolation tests)
        }

        user = role_map.get(role_header, MOCK_USERS_DB["dr_smith"])

        # Return a valid TokenData object to bypass JWT validation
        return TokenData(
            username=user["username"],
            role=user["role"],
            clinic_id=user["clinic_id"]
        )

    # Apply dependency overrides
    app.dependency_overrides[get_db] = override_get_db
    app.dependency_overrides[auth.get_current_user] = override_get_current_user

    # Yield TestClient within a context manager to ensure proper app lifecycle handling
    with TestClient(app) as test_client:
        yield test_client

    # Clean up overrides after the test concludes
    app.dependency_overrides.clear()