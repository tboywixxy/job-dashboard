import { NextRequest, NextResponse } from "next/server";

const AUTH_UPSTREAM =
  process.env.MASTASKILLZ_AUTH_API_BASE_URL ?? "https://dev.api.mastaskillz.com";

type RouteContext = {
  params: Promise<{ path: string[] }>;
};

async function proxyRequest(request: NextRequest, context: RouteContext) {
  const { path } = await context.params;
  const upstreamBase = AUTH_UPSTREAM.replace(/\/+$/, "");
  const upstreamUrl = new URL(`${upstreamBase}/${path.join("/")}`);
  upstreamUrl.search = request.nextUrl.search;

  const headers = new Headers();
  for (const name of ["authorization", "content-type", "cookie"]) {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  }

  try {
    const response = await fetch(upstreamUrl, {
      method: request.method,
      headers,
      body: request.method === "GET" || request.method === "HEAD"
        ? undefined
        : await request.arrayBuffer(),
      cache: "no-store",
      redirect: "manual",
    });

    const responseHeaders = new Headers({
      "Content-Type": response.headers.get("content-type") ?? "application/json",
    });
    const setCookie = response.headers.get("set-cookie");
    if (setCookie) responseHeaders.set("Set-Cookie", setCookie);

    return new Response(await response.arrayBuffer(), {
      status: response.status,
      headers: responseHeaders,
    });
  } catch (error) {
    console.error("Campaign API proxy failed:", error);
    return NextResponse.json(
      {
        code: 502,
        status: "Error",
        message: "Could not reach the campaign service.",
      },
      { status: 502 }
    );
  }
}

export const dynamic = "force-dynamic";
export const GET = proxyRequest;
export const POST = proxyRequest;
export const PATCH = proxyRequest;
export const PUT = proxyRequest;
export const DELETE = proxyRequest;
