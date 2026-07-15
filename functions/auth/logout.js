import { buildSessionCookie } from "../_lib/session.js";

function logoutResponse(request) {
  const loginUrl = new URL("/login.html", request.url);
  loginUrl.searchParams.set("logged_out", "1");

  return new Response(null, {
    status: 303,
    headers: {
      "Cache-Control": "no-store",
      "Location": loginUrl.href,
      "Set-Cookie": buildSessionCookie(request, "", 0)
    }
  });
}

export async function onRequestGet(context) {
  return logoutResponse(context.request);
}

export async function onRequestPost(context) {
  const origin = context.request.headers.get("Origin");
  const requestUrl = new URL(context.request.url);

  if (origin && origin !== requestUrl.origin) {
    return new Response("Forbidden", {
      status: 403,
      headers: { "Cache-Control": "no-store" }
    });
  }

  return logoutResponse(context.request);
}
