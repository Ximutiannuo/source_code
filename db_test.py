import os
from sqlalchemy import create_engine, text
from dotenv import load_dotenv

# Load .env from backend directory
env_path = os.path.join(os.getcwd(), 'backend', '.env')
load_dotenv(env_path)

db_url = os.getenv('DATABASE_URL')
print(f"Testing connection to: {db_url.split('@')[-1]}") # Hide credentials in output

try:
    engine = create_engine(db_url)
    with engine.connect() as connection:
        result = connection.execute(text("SELECT 1"))
        print("Successfully connected to the database!")
        print(f"Result of 'SELECT 1': {result.fetchone()}")
except Exception as e:
    print(f"Error connecting to the database: {e}")
