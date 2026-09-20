import { NextRequest } from "next/server";
import { proxyAuthSession } from "@/lib/authProxy";

export const POST = (request: NextRequest) => proxyAuthSession(request, "refresh");
