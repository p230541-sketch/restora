import { Request, Response } from "express";
import { signToken, authenticate, requireRole, AuthUser, AuthedRequest } from "./auth";

const USER: AuthUser = { id: "u1", email: "a@b.io", name: "Test", role: "SysAdmin" };

function mockRes() {
  const res: any = {};
  res.statusCode = 200;
  res.body = undefined;
  res.status = (c: number) => { res.statusCode = c; return res; };
  res.json = (b: any) => { res.body = b; return res; };
  return res as Response & { statusCode: number; body: any };
}

describe("signToken + authenticate", () => {
  it("accepts a freshly-signed token and populates req.user", () => {
    const token = signToken(USER);
    const req = { headers: { authorization: `Bearer ${token}` }, query: {} } as unknown as AuthedRequest;
    const res = mockRes();
    const next = jest.fn();

    authenticate(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(req.user?.id).toBe("u1");
    expect(req.user?.role).toBe("SysAdmin");
  });

  it("accepts a token via the ?token= query param (for SSE/EventSource)", () => {
    const token = signToken(USER);
    const req = { headers: {}, query: { token } } as unknown as AuthedRequest;
    const res = mockRes();
    const next = jest.fn();

    authenticate(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(req.user?.email).toBe("a@b.io");
  });

  it("rejects a request with no token (401)", () => {
    const req = { headers: {}, query: {} } as unknown as AuthedRequest;
    const res = mockRes();
    const next = jest.fn();

    authenticate(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(401);
  });

  it("rejects a malformed/invalid token (401)", () => {
    const req = { headers: { authorization: "Bearer not.a.jwt" }, query: {} } as unknown as AuthedRequest;
    const res = mockRes();
    const next = jest.fn();

    authenticate(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(401);
  });
});

describe("requireRole", () => {
  it("allows a user whose role is in the allow-list", () => {
    const req = { user: { ...USER, role: "BusinessOwner" } } as AuthedRequest;
    const res = mockRes();
    const next = jest.fn();

    requireRole("SysAdmin", "BusinessOwner")(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(res.statusCode).toBe(200);
  });

  it("blocks a user whose role is not allowed (403)", () => {
    const req = { user: { ...USER, role: "ReadOnly" } } as AuthedRequest;
    const res = mockRes();
    const next = jest.fn();

    requireRole("SysAdmin")(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(403);
  });

  it("returns 401 when no authenticated user is present", () => {
    const req = {} as AuthedRequest;
    const res = mockRes();
    const next = jest.fn();

    requireRole("SysAdmin")(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(401);
  });
});
