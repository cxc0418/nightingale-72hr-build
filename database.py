from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

# Define the SQLite database URL
SQLALCHEMY_DATABASE_URL = "sqlite:///./nightingale.db"

# Create the SQLAlchemy engine
# connect_args={"check_same_thread": False} is required for SQLite to work safely with FastAPI's async routing
engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    connect_args={"check_same_thread": False}
)

# Create a configured "Session" class
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Create a base class for our declarative database models
Base = declarative_base()


def get_db():
    """
    Dependency that creates a new SQLAlchemy session per request
    and ensures it is closed automatically after the request completes.
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()