import subprocess

APP_ROLE = "dnd_campaign_manager"
APP_PASSWORD = "dnd_campaign_manager"
APP_DATABASE = "dnd_campaign_manager"


def postgres(*args: str, capture: bool = False) -> str:
    result = subprocess.run(
        ["runuser", "-u", "postgres", "--", *args],
        check=True,
        capture_output=capture,
        text=True,
    )
    return result.stdout.strip() if capture else ""


def main() -> None:
    role_exists = postgres(
        "psql",
        "-tAc",
        f"SELECT 1 FROM pg_roles WHERE rolname = '{APP_ROLE}'",
        capture=True,
    )

    if role_exists != "1":
        postgres(
            "psql",
            "-c",
            f"CREATE ROLE {APP_ROLE} LOGIN PASSWORD '{APP_PASSWORD}' CREATEDB",
        )
        print(f"Created role {APP_ROLE}")
    else:
        print(f"Role {APP_ROLE} already exists")
        postgres("psql", "-c", f"ALTER ROLE {APP_ROLE} CREATEDB")
        print(f"Granted CREATEDB to {APP_ROLE}")

    database_exists = postgres(
        "psql",
        "-tAc",
        f"SELECT 1 FROM pg_database WHERE datname = '{APP_DATABASE}'",
        capture=True,
    )

    if database_exists != "1":
        postgres("createdb", "-O", APP_ROLE, APP_DATABASE)
        print(f"Created database {APP_DATABASE}")
    else:
        print(f"Database {APP_DATABASE} already exists")


if __name__ == "__main__":
    main()
