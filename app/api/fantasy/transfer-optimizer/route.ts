import type {NextRequest} from "next/server";
import {GET as optimizerGet} from "../../admin/fantasy/transfer-optimizer/route";

export const runtime="nodejs";
export const dynamic="force-dynamic";

export async function GET(request:NextRequest){
  return optimizerGet(request);
}
