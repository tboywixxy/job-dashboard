import { NextRequest, NextResponse } from "next/server";

export async function proxyAuthSession(request: NextRequest, action: "login" | "refresh") {
  const base = process.env.MASTASKILLZ_LOGIN_API_BASE_URL ?? "https://api.mastaskillz.com/auth";
  try {
    const headers = new Headers({ Accept: "application/json", "Content-Type": "application/json" });
    if (action === "refresh" && request.headers.get("cookie")) headers.set("cookie", request.headers.get("cookie")!);
    const response = await fetch(`${base.replace(/\/+$/, "")}/${action}`, {
      method: "POST", headers, body: await request.text(), cache: "no-store", redirect: "manual",
    });
    const responseHeaders = new Headers({ "Content-Type": response.headers.get("content-type") ?? "application/json", "Cache-Control": "no-store" });
    for (const cookie of response.headers.getSetCookie()) {
      responseHeaders.append("Set-Cookie", cookie.replace(/;\s*Domain=[^;]*/gi, "").replace(/;\s*Path=[^;]*/gi, "") + "; Path=/api");
    }
    return new Response(await response.arrayBuffer(), { status: response.status, headers: responseHeaders });
  } catch {
    return NextResponse.json({ code: 502, status: "Error", message: "Could not reach the MastaSkillz login service." }, { status: 502 });
  }
}
