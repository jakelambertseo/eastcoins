import {
  buildSessionCookie,
  constantTimeTextEqual,
  createSession,
  getCanonicalApprovedUser
} from "../_lib/session.js";

function safeNextPath(value) {
  const next = String(value || "").trim();

  if (
    next.startsWith("/") &&
    !next.startsWith("//") &&
    !next.startsWith("/auth/")
  ) {
    return next;
  }

  return "/";
}

function invalidLoginRedirect(request, next) {
  const loginUrl = new URL("/login.html", request.url);
  loginUrl.searchParams.set("error", "invalid");

  if (next && next !== "/") {
    loginUrl.searchParams.set("next", next);
  }

  return Response.redirect(loginUrl, 303);
}

export async function onRequestGet(context) {
  return Response.redirect(new URL("/login.html", context.request.url), 302);
}

export async function onRequestPost(context) {
  const { request, env } = context;
  const requestUrl = new URL(request.url);
  const origin = request.headers.get("Origin");

  if (origin && origin !== requestUrl.origin) {
    return new Response("Forbidden", {
      status: 403,
      headers: { "Cache-Control": "no-store" }
    });
  }

  if (!env.APPROVED_USERS || !env.SITE_PASSWORD || !env.SESSION_SECRET) {
    return new Response("EastCoins authentication is not configured.", {
      status: 500,
      headers: {
        "Cache-Control": "no-store",
        "Content-Type": "text/plain; charset=UTF-8"
      }
    });
  }

  let formData;

  try {
    formData = await request.formData();
  } catch {
    return invalidLoginRedirect(request, "/");
  }

  const username = String(formData.get("username") || "").trim();
  const password = String(formData.get("password") || "");
  const next = safeNextPath(formData.get("next"));

  if (
    username.length < 1 ||
    username.length > 80 ||
    password.length < 1 ||
    password.length > 200
  ) {
    return invalidLoginRedirect(request, next);
  }

  const approvedUsername = getCanonicalApprovedUser(username, env);
  const passwordMatches = await constantTimeTextEqual(
    password,
    env.SITE_PASSWORD
  );

  if (!approvedUsername || !passwordMatches) {
    return invalidLoginRedirect(request, next);
  }

  const sessionToken = await createSession(
    approvedUsername,
    env.SESSION_SECRET
  );

  return new Response(null, {
    status: 303,
    headers: {
      "Cache-Control": "no-store",
      "Location": next,
      "Set-Cookie": buildSessionCookie(request, sessionToken)
    }
  });
}
