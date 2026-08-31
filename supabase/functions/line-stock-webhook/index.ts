import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const LINE_REPLY_URL = "https://api.line.me/v2/bot/message/reply";
const BRAND_ORANGE = "#d87916";
const BRAND_ORANGE_SOFT = "#fff7ed";
const BRAND_ORANGE_TEXT = "#9a4f07";

const encoder = new TextEncoder();
const normalize = (value: string) =>
  value
    .toLowerCase()
    .replace(/^โรงเรียน\s*/u, "")
    .replace(/^(รร\.?|ร\.ร\.)\s*/u, "")
    .replace(/\s+/g, "");

async function verifyLineSignature(body: string, signature: string, secret: string) {
  if (!signature || !secret) return false;
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const digest = await crypto.subtle.sign("HMAC", key, encoder.encode(body));
  const base64 = btoa(String.fromCharCode(...new Uint8Array(digest)));
  return base64 === signature;
}

function getSupabaseKey() {
  const secretKeys = Deno.env.get("SUPABASE_SECRET_KEYS");
  if (secretKeys) {
    try {
      const parsed = JSON.parse(secretKeys);
      if (parsed.default) return parsed.default;
    } catch {
      // Fall through to explicit env names.
    }
  }
  return Deno.env.get("SUPABASE_SECRET_KEY") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
}

function textMessage(text: string) {
  return { type: "text", text };
}

function helpMessage() {
  return textMessage([
    "คำสั่งที่ใช้ได้",
    "stock ชื่อโรงเรียน",
    "รร ชื่อโรงเรียน",
    "office ชื่อสำนักงาน",
    "",
    "ตัวอย่าง: stock ศรีบางลาง",
  ].join("\n"));
}

function matchCommand(text: string) {
  const trimmed = text.trim();
  const school = trimmed.match(/^(?:stock|school|รร\.?|ร\.ร\.)\s+(.+)$/iu);
  if (school) return { type: "school", query: school[1].trim() };
  const office = trimmed.match(/^(?:office|สำนักงาน)\s+(.+)$/iu);
  if (office) return { type: "office", query: office[1].trim() };
  if (/^(help|ช่วย|คำสั่ง)$/iu.test(trimmed)) return { type: "help", query: "" };
  return { type: "unknown", query: trimmed };
}

async function reply(replyToken: string, messages: unknown[]) {
  const accessToken = Deno.env.get("LINE_CHANNEL_ACCESS_TOKEN") || "";
  if (!accessToken || !replyToken) return;
  await fetch(LINE_REPLY_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ replyToken, messages }),
  });
}

async function loadItems(supabase: ReturnType<typeof createClient>) {
  const { data, error } = await supabase
    .from("inventory_items")
    .select("*")
    .eq("active", true)
    .order("sort_order");
  if (error) throw error;
  return data || [];
}

function summarizeRows(items: any[], rows: any[]) {
  const byItem = new Map(rows.map((row) => [row.item_id, row]));
  const robotLines = items
    .filter((item) => item.category === "robot")
    .map((item) => {
      const row = byItem.get(item.id) || {};
      return {
        label: item.name,
        total: Number(row.quantity || 0),
        usable: Number(row.usable_quantity || 0),
        unit: item.unit || "ตัว",
      };
    });
  const supportLines = items
    .filter((item) => item.category !== "robot")
    .map((item) => {
      const row = byItem.get(item.id) || {};
      return {
        label: item.name,
        total: Number(row.quantity || 0),
        usable: Number(row.usable_quantity || 0),
        unit: item.unit || "ชิ้น",
      };
    })
    .filter((line) => line.total || line.usable)
    .slice(0, 6);
  const checkedAt = rows
    .map((row) => row.checked_at)
    .filter(Boolean)
    .sort()
    .at(-1) || "";
  return { robotLines, supportLines, checkedAt };
}

function lineAccent(line: { total: number; usable: number }) {
  if (!line.total && !line.usable) return "#94a3b8";
  if (line.usable <= 0) return "#dc2626";
  if (line.usable < line.total) return "#d97706";
  return "#0f766e";
}

function stockLineRow(line: { label: string; total: number; usable: number; unit: string }, size: "sm" | "xs" = "sm") {
  const accent = lineAccent(line);
  return {
    type: "box",
    layout: "horizontal",
    spacing: "md",
    paddingAll: "10px",
    backgroundColor: "#f8fafc",
    cornerRadius: "10px",
    contents: [
      { type: "separator", color: accent },
      {
        type: "box",
        layout: "vertical",
        flex: 5,
        contents: [
          { type: "text", text: line.label, size, color: "#172033", weight: "bold", wrap: true },
          { type: "text", text: line.usable < line.total ? "มีบางส่วนใช้ไม่ได้" : line.usable ? "พร้อมใช้ครบ" : "ยังไม่มีของพร้อมใช้", size: "xxs", color: accent, margin: "xs" },
        ],
      },
      {
        type: "box",
        layout: "vertical",
        flex: 3,
        alignItems: "flex-end",
        justifyContent: "center",
        contents: [
          { type: "text", text: `ใช้ได้ ${line.usable} ${line.unit}`, size: size === "sm" ? "sm" : "xs", color: accent, weight: "bold", align: "end" },
          { type: "text", text: `ทั้งหมด ${line.total} ${line.unit}`, size: "xxs", color: "#64748b", align: "end", wrap: true },
        ],
      },
    ],
  };
}

function stockFlex(title: string, subtitle: string, summary: ReturnType<typeof summarizeRows>) {
  const robotContents = summary.robotLines.map((line) => stockLineRow(line, "sm"));
  const supportContents = summary.supportLines.map((line) => stockLineRow(line, "xs"));
  const robotTotal = summary.robotLines.reduce((sum, line) => sum + line.total, 0);
  const robotUsable = summary.robotLines.reduce((sum, line) => sum + line.usable, 0);
  return {
    type: "flex",
    altText: title,
    contents: {
      type: "bubble",
      size: "mega",
      header: {
        type: "box",
        layout: "vertical",
        paddingAll: "18px",
        backgroundColor: BRAND_ORANGE,
        contents: [
          { type: "text", text: title, weight: "bold", size: "xl", color: "#ffffff", wrap: true },
          { type: "text", text: subtitle, size: "sm", color: "#ffedd5", margin: "sm", wrap: true },
        ],
      },
      body: {
        type: "box",
        layout: "vertical",
        spacing: "sm",
        paddingAll: "16px",
        backgroundColor: "#ffffff",
        contents: [
          {
            type: "box",
            layout: "horizontal",
            paddingAll: "12px",
            backgroundColor: BRAND_ORANGE_SOFT,
            cornerRadius: "12px",
            contents: [
              {
                type: "box",
                layout: "vertical",
                flex: 1,
                contents: [
                  { type: "text", text: "หุ่นพร้อมใช้", size: "xxs", color: "#64748b", weight: "bold" },
                  { type: "text", text: `${robotUsable}`, size: "xl", color: BRAND_ORANGE_TEXT, weight: "bold" },
                ],
              },
              {
                type: "box",
                layout: "vertical",
                flex: 1,
                alignItems: "flex-end",
                contents: [
                  { type: "text", text: "หุ่นทั้งหมด", size: "xxs", color: "#64748b", weight: "bold", align: "end" },
                  { type: "text", text: `${robotTotal}`, size: "xl", color: "#172033", weight: "bold", align: "end" },
                ],
              },
            ],
          },
          { type: "text", text: "รายการหุ่นยนต์", size: "xs", color: "#64748b", weight: "bold", margin: "md" },
          {
            type: "box",
            layout: "vertical",
            spacing: "xs",
            contents: robotContents.length ? robotContents : [{ type: "text", text: "ยังไม่มีข้อมูลหุ่น", size: "sm", color: "#94a3b8" }],
          },
          ...(supportContents.length
            ? [
              { type: "separator", margin: "md" },
              { type: "text", text: "อุปกรณ์และสนาม", size: "xs", color: "#64748b", weight: "bold", margin: "md" },
              { type: "box", layout: "vertical", spacing: "xs", contents: supportContents },
            ]
            : []),
          {
            type: "text",
            text: summary.checkedAt ? `เช็คล่าสุด ${summary.checkedAt}` : "ยังไม่มีวันที่เช็คล่าสุด",
            size: "xxs",
            color: "#94a3b8",
            margin: "md",
          },
        ],
      },
    },
  };
}

async function schoolStockMessage(supabase: ReturnType<typeof createClient>, query: string) {
  const normalizedQuery = normalize(query);
  const { data: schools, error } = await supabase
    .from("schools")
    .select("id,name,academic_year,term")
    .eq("is_deleted", false)
    .ilike("name", `%${query}%`)
    .limit(6);
  if (error) throw error;
  const matches = (schools || []).filter((school) => normalize(school.name).includes(normalizedQuery));
  if (!matches.length) return textMessage(`ไม่พบโรงเรียนที่ตรงกับ "${query}"`);
  if (matches.length > 1) return textMessage(`เจอหลายโรงเรียน:\n${matches.map((s) => `- ${s.name}`).join("\n")}\n\nพิมพ์ชื่อให้เจาะจงขึ้นอีกนิดครับ`);
  const target = matches[0];
  const [items, inventory] = await Promise.all([
    loadItems(supabase),
    supabase.from("school_inventory").select("*").eq("school_id", target.id),
  ]);
  if (inventory.error) throw inventory.error;
  return stockFlex(target.name, `ปี ${target.academic_year || "-"} ภาค ${target.term || "-"}`, summarizeRows(items, inventory.data || []));
}

async function officeStockMessage(supabase: ReturnType<typeof createClient>, query: string) {
  const { data: offices, error } = await supabase
    .from("offices")
    .select("id,name")
    .eq("active", true)
    .ilike("name", `%${query}%`)
    .limit(6);
  if (error) throw error;
  if (!offices?.length) return textMessage(`ไม่พบสำนักงานที่ตรงกับ "${query}"`);
  if (offices.length > 1) return textMessage(`เจอหลายสำนักงาน:\n${offices.map((o) => `- ${o.name}`).join("\n")}\n\nพิมพ์ชื่อให้เจาะจงขึ้นอีกนิดครับ`);
  const target = offices[0];
  const [items, inventory] = await Promise.all([
    loadItems(supabase),
    supabase.from("office_inventory").select("*").eq("office_id", target.id),
  ]);
  if (inventory.error) throw inventory.error;
  return stockFlex(`Stock ${target.name}`, "นับเฉพาะ stock ของสำนักงาน ไม่รวมของโรงเรียน", summarizeRows(items, inventory.data || []));
}

serve(async (req) => {
  if (req.method === "GET") return new Response("line-stock-webhook ok", { status: 200 });
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

  const body = await req.text();
  const channelSecret = Deno.env.get("LINE_CHANNEL_SECRET") || "";
  const signature = req.headers.get("x-line-signature") || "";
  const valid = await verifyLineSignature(body, signature, channelSecret);
  if (!valid) return new Response("Unauthorized", { status: 401 });

  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  const supabaseKey = getSupabaseKey();
  if (!supabaseUrl || !supabaseKey) return new Response("Missing Supabase env", { status: 500 });
  const supabase = createClient(supabaseUrl, supabaseKey, { auth: { persistSession: false } });

  const payload = JSON.parse(body);
  await Promise.all((payload.events || []).map(async (event: any) => {
    if (event.type !== "message" || event.message?.type !== "text") return;
    const command = matchCommand(event.message.text || "");
    let message: unknown = helpMessage();
    try {
      if (command.type === "school") message = await schoolStockMessage(supabase, command.query);
      else if (command.type === "office") message = await officeStockMessage(supabase, command.query);
      else if (command.type === "help") message = helpMessage();
      else message = textMessage('พิมพ์ "help" เพื่อดูคำสั่ง หรือใช้ "stock ชื่อโรงเรียน"');
    } catch (error) {
      console.error(error);
      message = textMessage(`ขออภัย ดึงข้อมูลไม่สำเร็จ: ${error.message || "unknown error"}`);
    }
    await reply(event.replyToken, [message]);
  }));

  return new Response("OK", { status: 200 });
});
