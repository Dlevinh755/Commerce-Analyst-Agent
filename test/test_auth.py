def register_user(client, username="buyer01", password="123456", email="buyer01@example.com"):
    return client.post(
        "/auth/register",
        json={
            "username": username,
            "password": password,
            "email": email,
            "full_name": "Buyer Test",
        },
    )


def login_user(client, username="buyer01", password="123456"):
    return client.post(
        "/auth/login",
        json={
            "username": username,
            "password": password,
        },
    )


def test_register_success(client):
    response = register_user(client)
    assert response.status_code == 201
    data = response.json()
    assert data["username"] == "buyer01"
    assert data["role"] == "buyer"


def test_register_duplicate_username(client):
    register_user(client)
    response = register_user(client, email="another@example.com")
    assert response.status_code == 400
    assert response.json()["detail"] == "Username already exists"


def test_login_success(client):
    register_user(client)
    response = login_user(client)
    assert response.status_code == 200

    data = response.json()
    assert "access_token" in data
    assert "refresh_token" in data
    assert data["token_type"] == "bearer"
    assert data["user"]["username"] == "buyer01"


def test_login_wrong_password(client):
    register_user(client)
    response = login_user(client, password="wrongpass")
    assert response.status_code == 401


def test_me_success(client):
    register_user(client)
    login_response = login_user(client)
    access_token = login_response.json()["access_token"]

    response = client.get(
        "/auth/me",
        headers={"Authorization": f"Bearer {access_token}"}
    )
    assert response.status_code == 200
    assert response.json()["username"] == "buyer01"


def test_verify_success(client):
    register_user(client)
    login_response = login_user(client)
    access_token = login_response.json()["access_token"]

    response = client.get(
        "/auth/verify",
        headers={"Authorization": f"Bearer {access_token}"}
    )
    assert response.status_code == 200
    data = response.json()
    assert data["valid"] is True
    assert data["user"]["username"] == "buyer01"


def test_refresh_success(client):
    register_user(client)
    login_response = login_user(client)
    refresh_token = login_response.json()["refresh_token"]

    response = client.post(
        "/auth/refresh",
        json={"refresh_token": refresh_token}
    )
    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data
    assert "refresh_token" in data


def test_logout_success(client):
    register_user(client)
    login_response = login_user(client)
    refresh_token = login_response.json()["refresh_token"]

    response = client.post(
        "/auth/logout",
        json={"refresh_token": refresh_token}
    )
    assert response.status_code == 200
    assert response.json()["message"] == "Logged out successfully"

    refresh_again = client.post(
        "/auth/refresh",
        json={"refresh_token": refresh_token}
    )
    assert refresh_again.status_code == 401


def test_change_password_success(client):
    register_user(client)
    login_response = login_user(client)
    access_token = login_response.json()["access_token"]
    refresh_token = login_response.json()["refresh_token"]

    response = client.post(
        "/auth/change-password",
        json={
            "old_password": "123456",
            "new_password": "654321",
        },
        headers={"Authorization": f"Bearer {access_token}"}
    )
    assert response.status_code == 200

    old_login = login_user(client, password="123456")
    assert old_login.status_code == 401

    new_login = login_user(client, password="654321")
    assert new_login.status_code == 200

    refresh_old = client.post("/auth/refresh", json={"refresh_token": refresh_token})
    assert refresh_old.status_code == 401