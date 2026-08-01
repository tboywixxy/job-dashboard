import { NextRequest, NextResponse } from "next/server";

const LOGIN_UPSTREAM =
  process.env.MASTASKILLZ_LOGIN_API_BASE_URL ?? "https://api.mastaskillz.com/auth";

export async function POST(request: NextRequest) {
  try {
    const response = await fetch(`${LOGIN_UPSTREAM.replace(/\/+$/, "")}/login`, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: await request.text(),
      cache: "no-store",
    });

    return new Response(await response.arrayBuffer(), {
      status: response.status,
      headers: {
        "Content-Type": response.headers.get("content-type") ?? "application/json",
      },
    });
  } catch (error) {
    console.error("Admin login proxy failed:", error);
    return NextResponse.json(
      { code: 502, status: "Error", message: "Could not reach the MastaSkillz login service." },
      { status: 502 }
    );
  }
}
