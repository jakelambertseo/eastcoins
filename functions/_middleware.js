import {
  SESSION_COOKIE_NAME,
  buildSessionCookie,
  constantTimeTextEqual,
  createSession,
  getCanonicalApprovedUser,
  getCookie,
  verifySession
} from "./_lib/session.js";

function authenticationIsConfigured(env) {
  return Boolean(
    env.APPROVED_USERS &&
    env.SITE_PASSWORD &&
    env.SESSION_SECRET
  );
}

function basicAuthChallenge() {
  return new Response("Authentication required.", {
    status: 401,
    headers: {
      "Cache-Control": "no-store",
      "Content-Type": "text/plain; charset=UTF-8",
      "WWW-Authenticate": 'Basic realm="EastCoins", charset="UTF-8"'
    }
  });
}

function decodeBasicAuthorization(request) {
  const authorization = request.headers.get("Authorization") || "";
  const [scheme, encodedCredentials] = authorization.split(/\s+/, 2);

  if (
    scheme?.toLowerCase() !== "basic" ||
    !encodedCredentials
  ) {
    return null;
  }

  try {
    const decoded = atob(encodedCredentials);
    const separatorIndex = decoded.indexOf(":");

    if (separatorIndex < 0) return null;

    return {
      username: decoded.slice(0, separatorIndex).trim(),
      password: decoded.slice(separatorIndex + 1)
    };
  } catch {
    return null;
  }
}

function redirectToSameRequest(request, sessionCookie) {
  const requestUrl = new URL(request.url);

  return new Response(null, {
    status: 302,
    headers: {
      "Cache-Control": "no-store",
      "Location": `${requestUrl.pathname}${requestUrl.search}`,
      "Set-Cookie": sessionCookie
    }
  });
}

export async function onRequest(context) {
  const { request, env } = context;

  if (!authenticationIsConfigured(env)) {
    return new Response(
      "EastCoins authentication is not configured.",
      {
        status: 500,
        headers: {
          "Cache-Control": "no-store",
          "Content-Type": "text/plain; charset=UTF-8"
        }
      }
    );
  }

  const sessionToken = getCookie(
    request,
    SESSION_COOKIE_NAME
  );

  const session = await verifySession(
    sessionToken,
    env.SESSION_SECRET
  );

  if (session) {
    const approvedSessionUser = getCanonicalApprovedUser(
      session.username,
      env
    );

    if (approvedSessionUser) {
      const response = await context.next();
      const protectedResponse = new Response(response.body, response);

      protectedResponse.headers.set(
        "X-Robots-Tag",
        "noindex, nofollow"
      );

      const contentType =
        protectedResponse.headers.get("Content-Type") || "";

      if (contentType.includes("text/html")) {
        protectedResponse.headers.set(
          "Cache-Control",
          "private, no-store"
        );
      }

      return protectedResponse;
    }
  }

  const credentials = decodeBasicAuthorization(request);

  if (!credentials) {
    return basicAuthChallenge();
  }

  const approvedUsername = getCanonicalApprovedUser(
    credentials.username,
    env
  );

  const passwordMatches = await constantTimeTextEqual(
    credentials.password,
    env.SITE_PASSWORD
  );

  if (!approvedUsername || !passwordMatches) {
    return basicAuthChallenge();
  }

  const newSession = await createSession(
    approvedUsername,
    env.SESSION_SECRET
  );

  return redirectToSameRequest(
    request,
    buildSessionCookie(request, newSession)
  );
}
