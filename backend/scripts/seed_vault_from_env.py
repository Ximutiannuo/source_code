import os
import hvac
from pathlib import Path

# Config
VAULT_ADDR = "http://127.0.0.1:8200"
VAULT_TOKEN = "project-root-token"  # Fixed token for dev mode

def seed_vault():
    client = hvac.Client(url=VAULT_ADDR, token=VAULT_TOKEN)
    
    if not client.is_authenticated():
        print("Vault authentication failed")
        return

    # 1. Enable KV-v2 if not enabled
    try:
        client.sys.enable_secrets_engine(
            backend_type='kv',
            path='secret',
            options={'version': '2'}
        )
        print("KV-v2 engine enabled at 'secret/'")
    except Exception:
        print("KV engine already exists or error enabling it")

    # 2. Seed db-roles/system_admin (using root password from .env)
    # Current root password in .env: Ww@1932635539
    client.secrets.kv.v2.create_or_update_secret(
        path='db-roles/system_admin',
        secret={
            'username': 'root',
            'password': 'Ww@1932635539'
        },
        mount_point='secret'
    )
    print("Seeded 'db-roles/system_admin'")

    # 3. Seed app-config
    client.secrets.kv.v2.create_or_update_secret(
        path='app-config',
        secret={
            'secret_key': '4e5a9b8c7d6e5f4a3b2c1d0e9f8a7b6c5d4e3f2a1b0c9d8e7f6a5b4c3d2e1f0a',
            'algorithm': 'HS256'
        },
        mount_point='secret'
    )
    print("Seeded 'app-config'")

    print("\nVault seeding complete.")

if __name__ == "__main__":
    seed_vault()
