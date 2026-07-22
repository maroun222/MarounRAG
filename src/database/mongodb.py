from pymongo import MongoClient
from dotenv import load_dotenv
import os

# Load variables from .env.local
load_dotenv(".env.local")

MONGODB_URL = os.getenv("MONGODB_URL")
MONGODB_DATABASE = os.getenv("MONGODB_DATABASE")

if not MONGODB_URL:
    raise ValueError("MONGODB_URL is missing from .env.local")

if not MONGODB_DATABASE:
    raise ValueError("MONGODB_DATABASE is missing from .env.local")


class MongoDB:
    def __init__(self):
        self.client = None
        self.db = None

    def connect(self):
        if self.client is None:
            print("Connecting to MongoDB...")
            self.client = MongoClient(MONGODB_URL)
            self.client.admin.command("ping")
            self.db = self.client[MONGODB_DATABASE]
            print("MongoDB connected successfully.")

    def close(self):
        if self.client is not None:
            self.client.close()
            self.client = None
            self.db = None
            print("MongoDB connection closed.")

    @property
    def users(self):
        return self.db["users"]

    @property
    def conversations(self):
        return self.db["conversations"]

    @property
    def messages(self):
        return self.db["messages"]


mongodb = MongoDB()