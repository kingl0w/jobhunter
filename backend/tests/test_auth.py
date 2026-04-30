def test_health_is_public(client):
    r = client.get("/health")
    assert r.status_code == 200
    assert r.json()["status"] == "ok"


def test_unauthed_endpoints_return_401(client):
    for path in ["/jobs", "/resumes", "/search-terms", "/auth/me", "/auth/quota"]:
        assert client.get(path).status_code == 401, path


def test_bad_password_rejected(client):
    r = client.post("/auth/login", json={"app_password": "wrong", "username": "ian"})
    assert r.status_code == 401


def test_login_creates_user_and_sets_cookie(client):
    r = client.post("/auth/login", json={"app_password": "testpass", "username": "ian"})
    assert r.status_code == 200
    body = r.json()
    assert body["user"]["username"] == "ian"
    assert body["user"]["is_demo"] is False
    me = client.get("/auth/me")
    assert me.status_code == 200
    assert me.json()["username"] == "ian"


def test_logout_clears_session(authed_client):
    authed_client.post("/auth/logout")
    assert authed_client.get("/auth/me").status_code == 401


def test_login_is_idempotent_for_same_username(client):
    r1 = client.post("/auth/login", json={"app_password": "testpass", "username": "ian"})
    client.post("/auth/logout")
    r2 = client.post("/auth/login", json={"app_password": "testpass", "username": "ian"})
    assert r1.json()["user"]["id"] == r2.json()["user"]["id"]
