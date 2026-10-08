import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

// E-posti kinnituse / OAuthi / parooli taastamise link suunab siia (?code=...).
// Pärast sessiooni loomist suunatakse edasi aadressile ?next=/... (vaikimisi "/").
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/";
  const safeNext = next.startsWith("/") && !next.startsWith("//") ? next : "/";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(new URL(safeNext, origin));
    }
  }

  const failed = new URL("/", origin);
  failed.searchParams.set("auth_error", "1");
  return NextResponse.redirect(failed);
}
