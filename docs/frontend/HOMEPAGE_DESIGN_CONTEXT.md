# Homepage Design Context

Tài liệu này mô tả ngôn ngữ thiết kế của trang chủ (Landing) dự án **Workflow Pipeline Engine**, để làm khung khi thiết kế trang chủ cho dự án khác. Giữ phong cách, thay nội dung.

Nguồn gốc (đọc từ code thật):
- `wpe-frontend/src/components/landing/*` — các section của trang chủ
- `wpe-frontend/tailwind.config.js` — màu, bóng, keyframe
- `wpe-frontend/src/lib/motion.ts` — easing, spring, variants
- `wpe-frontend/src/motion/SmoothScrollProvider.tsx` — cuộn mượt Lenis

---

## 1. Tinh thần thiết kế

- **Kiểu:** SaaS kỹ thuật, phong cách "editorial" (giống Mixpanel / Linear / Vercel). Nền sáng, ấm; điểm nhấn tím + cam san hô.
- **Cảm giác:** chính xác, cao cấp, "có kỹ thuật thật". Không minh họa hoạt hình; thay vào đó là **UI giả lập tương tác được** (mock app thật nhỏ) đặt ngay trên trang.
- **Nguyên tắc:**
  1. Chữ tiêu đề to, mảnh (font-medium), letter-spacing âm.
  2. Một cụm chữ cuối tiêu đề luôn tô gradient tím → cam.
  3. Mỗi section mở đầu bằng badge viên thuốc (kicker) chữ IN HOA.
  4. Chứng minh bằng demo: người xem bấm được, trạng thái đổi thật.
  5. Chuyển động mềm, có quán tính; tôn trọng `prefers-reduced-motion`.
  6. Chi tiết kỹ thuật dùng font mono (mã, nhãn, trạng thái).

## 2. Tech stack

| Thư viện | Phiên bản | Dùng cho |
|---|---|---|
| React | ^18.3.1 | UI |
| Vite | ^5.4.8 | build |
| Tailwind CSS | ^3.4.17 | style |
| framer-motion | ^14.3.0 | animation, layoutId, whileInView |
| lenis | ^1.3.27 | smooth scroll cấp window |
| lucide-react | ^0.468.0 | icon (Sparkles, ArrowRight, Eye, CheckCircle2, Lock, ShieldCheck…) |
| clsx | ^2.1.1 | ghép class |

Toàn trang bọc trong `<MotionConfig reducedMotion="user">` + `<SmoothScrollProvider>`.

## 3. Design tokens

### 3.1 Màu (namespace `mp-*` trong Tailwind)

**Thương hiệu chính – Tím**
| Token | Hex | Vai trò |
|---|---|---|
| `mp-eggplant` | `#15003F` | nền card tối, toast |
| `mp-purple-200` | `#1B0B3B` | nền tối sâu, chữ trên nền tím nhạt |
| `mp-purple-150` | `#5028C0` | **màu primary** (nút, logo, chữ nhấn) |
| `mp-purple-100` | `#7856FF` | hover primary, điểm giữa gradient, viền focus |
| `mp-purple-40` | `#B094FF` | chữ nhấn trên nền tối |
| `mp-purple-20` | `#E8DDFF` | nền badge, nền tab active |
| `mp-purple-50` | `#F5F0FF` | nền rất nhạt |

**Màu phụ**
| Nhóm | 20 (nền) | 40 | 100 | 150 (đậm) | 200 (rất đậm) |
|---|---|---|---|---|---|
| `mp-lava` (đỏ cam) | `#FFE1D6` | `#FFB0A3` | `#FF7557` | `#CC332B` | `#5B0237` |
| `mp-mint` (thành công) | `#E0FAFA` | `#BCF0F0` | `#80E1D9` | `#07B096` | `#122E29` |
| `mp-amber` (cảnh báo) | `#FFEFDB` | `#FEDE9B` | `#F8BC3B` | `#DA6B16` | `#A33B16` |
| `mp-coral` | `#FF8E75` (điểm cuối gradient) | | | | |

**Trung tính**
| Token | Hex | Vai trò |
|---|---|---|
| `mp-ink` | `#1F1F24` | chữ chính, tiêu đề |
| `mp-n-50` | `#FBF9F9` | **nền section xen kẽ** (trắng ấm) |
| `mp-n-100` | `#F5F2F2` | nền hover nhẹ, đường kẻ trong card |
| `mp-n-200` | `#EAE7E7` | viền card, viền section |
| `mp-n-300` | `#E9E9E9` | viền nút secondary |
| `mp-n-400` | `#C0C0C0` | chữ mờ |
| `mp-n-500` | `#9B9B9B` | chữ phụ, nhãn mono |
| `mp-n-600` | `#626266` | **chữ thân bài** |

**Gradient chữ chuẩn** (dùng cho cụm cuối tiêu đề và thanh tiến độ cuộn):
```
bg-gradient-to-r from-mp-purple-150 via-[#7856FF] to-mp-coral bg-clip-text text-transparent
```
Biến thể ở CTA cuối: `from-mp-purple-150 via-[#FF8E75] to-mp-coral`.

### 3.2 Typography

- Font: `Inter, system-ui, sans-serif`. Font mono mặc định của Tailwind cho nhãn kỹ thuật.
  - Lưu ý: dự án gốc khai báo Inter trong Tailwind nhưng `index.html` **không** nạp Google Fonts. Dự án mới nên thêm link nạp Inter.

| Vai trò | Class |
|---|---|
| H1 hero | `text-[40px] sm:text-[54px] lg:text-[72px] leading-[1.08] font-medium tracking-[-0.03em] text-mp-ink max-w-5xl` |
| H2 section | `text-3xl sm:text-5xl font-medium tracking-tight text-mp-ink` (CTA cuối thêm `lg:text-6xl`) |
| H3 trong tab/card | `text-2xl sm:text-3xl font-medium` hoặc `text-xl font-semibold` |
| Lead / subtitle | `text-base sm:text-lg leading-7 sm:leading-8 text-mp-n-600 max-w-2xl` |
| Body nhỏ | `text-sm text-mp-n-600 leading-relaxed` |
| Kicker badge | `text-xs font-semibold uppercase tracking-wide` |
| Nhãn mono | `font-mono text-[10px]–text-xs font-semibold uppercase tracking-wider` |
| Số thống kê | `text-5xl sm:text-6xl font-medium tracking-[-0.04em] tabular-nums` |

Quy tắc: tiêu đề lớn dùng **font-medium** (không bold), chỉ tiêu đề nhỏ (h3/h4 trong card) mới `font-bold`.

### 3.3 Bo góc, bóng, viền

- Bo góc: nút/badge/tab = `rounded-full`; card lớn = `rounded-3xl`; khối con trong card = `rounded-2xl`; ô nhỏ = `rounded-xl`; icon box = `rounded-xl`/`rounded-2xl`.
- Viền: `border border-mp-n-200` gần như ở mọi card; viền tách section `border-t border-mp-n-200`.

| Shadow | Giá trị | Dùng cho |
|---|---|---|
| `shadow-xs` | `0 1px 2px rgba(0,0,0,.05)` | badge, nút phụ |
| `shadow-mp-card` | `0 1px 2px rgba(27,11,59,.06), 0 8px 24px -8px rgba(27,11,59,.12)` | card thường |
| `shadow-mp-float` | `0 2px 4px rgba(27,11,59,.06), 0 24px 48px -12px rgba(27,11,59,.25)` | mock UI lớn, card nổi |
| `shadow-mp-glow` | `0 0 0 1px rgba(176,148,255,.35), 0 0 48px -8px rgba(120,86,255,.55)` | nút primary, logo |

Bóng luôn pha màu tím đậm (`27,11,59`) chứ không dùng đen thuần.

### 3.4 Layout

- Container: `mx-auto max-w-7xl px-4 sm:px-6 lg:px-8` (CTA cuối: `max-w-5xl`; header section: `max-w-3xl text-center`).
- Khoảng dọc section: `py-20 lg:py-32` (stats: `py-16 lg:py-24`; hero: `pt-12 pb-20 lg:pt-20 lg:pb-28`).
- Nền xen kẽ: trắng → `#FBF9F9` → … ; giữa các section là viền `border-mp-n-200`.
- Breakpoint chính: `sm` (640), `lg` (1024). Nav giữa ẩn dưới `lg`.

## 4. Cấu trúc trang (từ trên xuống)

```
┌─ Thanh tiến độ cuộn (fixed, cao 2.5px, gradient tím→cam)
├─ 1. Navbar dính (glass)
├─ 2. Hero: kicker · H1 gradient · lead · 2 CTA · mock UI tương tác
├─ 3. Product Tour: header + tab switcher (5 tab) + nội dung 2 cột
├─ 4. Bento kiến trúc: lưới 6 cột, 4 card tối (4+2 / 3+3)
├─ 5. Stats ribbon: 4 số đếm tăng dần
└─ 6. CTA cuối + Mega footer (5 cột)
```

### 4.1 Thanh tiến độ cuộn
- `fixed top-0 inset-x-0 h-[2.5px] z-50 bg-black/5`, thanh con gradient `from-mp-purple-150 via-[#7856FF] to-mp-coral`, `origin-left`, `transform: scaleX(progress)`.
- Progress cập nhật trực tiếp vào DOM từ sự kiện scroll của Lenis (không re-render React).

### 4.2 Navbar
- `sticky top-0 z-40 border-b border-mp-n-200 bg-white/80 backdrop-blur-md`, `py-3.5`.
- Trái: logo = ô vuông `h-9 w-9 rounded-xl bg-mp-purple-150 text-white shadow-mp-glow` chứa icon + tên (`text-base font-bold tracking-tight`) + dòng phụ mono (`text-[10px] font-mono uppercase text-mp-purple-150`, ví dụ "V2.4 DAG ORCHESTRATOR"). Bấm logo → cuộn về đầu.
- Giữa (chỉ `lg`): 5 link neo `text-xs font-semibold text-mp-n-600 hover:text-mp-ink gap-7`, cuộn mượt tới section (offset −70px).
- Phải: nút viền "Guest View" (ẩn dưới `sm`) · nút ghost "Sign In" · MagneticButton primary size sm "Get Started →".

### 4.3 Hero
- Quả cầu sáng nền: `absolute -top-24 left-1/2 h-[600px] w-[900px] rounded-full blur-[120px]`, `radial-gradient(circle, rgba(120,86,255,.22) 0%, rgba(255,117,87,.12) 40%, transparent 70%)`, "thở" lặp vô hạn (y 0→−18→0, scale 1→1.05, opacity .35→.45, 10s).
- Nội dung căn giữa, xuất hiện tuần tự (stagger):
  1. Kicker badge: `rounded-full bg-mp-purple-20 px-4 py-1.5 text-mp-purple-150 border border-mp-purple-100/20` + icon Sparkles.
  2. H1: câu chính + cụm cuối gradient. Mẫu: *"Orchestrate engineering workflows **with architectural precision.**"*
  3. Lead 1–2 câu nêu 3–4 năng lực chính.
  4. 2 CTA: MagneticButton primary lg ("Launch Workspace →") + nút viền trắng lg ("Explore Guest Demo →", mũi tên màu tím).
  5. Mock UI tương tác (`mt-14 lg:mt-16`).
- **Mock UI hero** (`HeroPipelineSimulator`): card `max-w-5xl rounded-3xl border bg-white p-5 sm:p-7 shadow-mp-float`, nhấc lên 3px khi hover.
  - Thanh cửa sổ: 3 chấm macOS (đỏ/vàng/xanh) + tên file mono + pill trạng thái "live" (chấm mint nhấp nháy) + nút "Reset Demo".
  - Vùng canvas: `rounded-2xl bg-gradient-to-b from-mp-n-50 to-white` + lưới chấm (`radial-gradient(#9B9B9B 1px, transparent 1px)` 20px, opacity 40%).
  - 3 card node ngang nhau thể hiện một luồng: DONE (viền mint) → REVIEW (viền tím + ring, có nút hành động) → LOCKED (viền đứt, nền xám).
  - Bấm nút → node 2 sang DONE, 600ms sau node 3 mở khóa (xanh dương) + toast tròn nền `mp-eggplant` trượt lên ở đáy card, tự ẩn sau 4.5s.
  - **Áp vào dự án mới:** thay bằng một "luồng 3 bước" cốt lõi của sản phẩm mới, có đúng 1 hành động người xem bấm được.

### 4.4 Product Tour (tab)
- Nền `#FBF9F9`, aura tím mờ phía trên.
- Header căn giữa: kicker + H2 + lead + **SmoothTabSwitcher**.
- SmoothTabSwitcher: khay `rounded-full border border-mp-n-200 bg-white/80 p-1.5 backdrop-blur-md`, cuộn ngang trên mobile (ẩn scrollbar). Tab active có viên thuốc trượt `bg-mp-purple-20 border-mp-purple-100/25` dùng `layoutId` + spring `pill`.
- Nội dung mỗi tab (đổi bằng `AnimatePresence mode="wait"`, y ±16, 0.35s):
  - Lưới `lg:grid-cols-[5fr_7fr] gap-10 lg:gap-12 items-center`.
  - Trái: nhãn mono nhỏ (`rounded-lg bg-mp-purple-20 font-mono font-bold`) → H3 → đoạn mô tả → 2 "feature row" (`rounded-xl border bg-white p-3.5`, icon box màu + tiêu đề IN HOA + mô tả).
  - Phải: mock UI `rounded-3xl border bg-white p-6 shadow-mp-float`, mở đầu bằng banner trạng thái (chấm nhấp nháy + chữ mono), có điều khiển tương tác riêng.

### 4.5 Bento kiến trúc
- Nền `#FBF9F9` + 2 quả cầu sáng (cam góc trên phải, tím góc dưới trái), "thở" 9–11s.
- Header căn giữa như 4.4.
- Lưới `grid gap-4 lg:grid-cols-6 lg:gap-6`; hàng 1: card `col-span-4` + `col-span-2`; hàng 2: `col-span-3` + `col-span-3`.
- **MixpanelBentoCard (tone dark):**
  - Vỏ `rounded-3xl p-px bg-white/10` (viền 1px), thân `bg-[#15003F]/90 backdrop-blur-xl text-white p-6 sm:p-8`.
  - Hover: nhấc −4px (spring card); **spotlight theo chuột** — viền sáng `radial-gradient(260px at x y, rgba(176,148,255,.9), transparent 70%)` và nền `radial-gradient(420px at x y, rgba(120,86,255,.18), transparent 70%)`.
  - Bố cục trong card: hàng trên = icon box (`h-10 w-10 rounded-2xl`, nền màu/20, viền màu/30) + nhãn mono pill bên phải; rồi H3 trắng; mô tả `text-white/70`; cuối là một "mini visual" (khối code mono `bg-black/40`, lưới 3 ô chỉ số, hoặc chuỗi bước A ➔ B ➔ C).
  - Mỗi card một màu nhấn: tím (`#B094FF`), lava (`#FF7557`), mint (`#80E1D9`), amber (`#F8BC3B`).

### 4.6 Stats ribbon
- `border-y border-mp-n-200 bg-[#FBF9F9]`, lưới `sm:grid-cols-2 lg:grid-cols-4 gap-8 lg:gap-12`.
- Mỗi ô: số to (CountUp đếm khi vào khung nhìn, thời lượng lệch 1.5s + 0.2s × index) → tiêu đề `font-bold` → mô tả nhỏ. Căn giữa trên mobile, căn trái từ `sm`. Hover nhấc −1.

### 4.7 CTA cuối + Footer
- CTA: nền `from-[#FBF9F9] via-white to-white`, quả cầu tím→san hô ở giữa (thở 8s). Kicker + H2 (`lg:text-6xl`, cụm cuối gradient) + lead + 1 MagneticButton primary lg + 2 nút viền nhỏ kiểu glass (`bg-white/80 backdrop-blur-md text-sm px-5 py-2.5`).
- Footer: `border-t bg-white py-16`, lưới `md:grid-cols-2 lg:grid-cols-5`:
  - Cột thương hiệu (`lg:col-span-2`): logo như navbar + mô tả ngắn + dòng trạng thái mono có chấm mint nhấp nháy.
  - 3 cột link: tiêu đề `text-xs font-bold uppercase tracking-wider text-mp-n-500 font-mono`, link `text-sm text-mp-n-600 hover:text-mp-purple-150`.
  - Dải cuối: `border-t pt-8 text-xs text-mp-n-500`, trái bản quyền, phải chấm trạng thái + phiên bản mono.

## 5. Component dùng lại

| Component | Tóm tắt |
|---|---|
| `MagneticButton` | Nút viên thuốc, bị "hút" theo chuột (dịch 25% khoảng cách tới tâm, spring magnet), có vệt shimmer chạy ngang (primary). Variant: primary / secondary / white / ghost. Size sm / md / lg. Tắt hút khi đang cuộn. |
| `SmoothTabSwitcher` | Tab dạng viên thuốc với nền active trượt (`layoutId`). Hỗ trợ icon + badge. `role="tablist"`. |
| `MixpanelBentoCard` | Card viền 1px + spotlight theo chuột, tone light/dark. Tắt spotlight khi đang cuộn. |
| `CountUp` | Đếm số khi vào viewport (once), easing `out`, định dạng `en-US`. |
| Kicker badge | `inline-flex items-center gap-2 rounded-full bg-mp-purple-20 px-3.5 py-1 text-xs font-semibold uppercase text-mp-purple-150 border border-mp-purple-100/20` + icon 13px. |
| Status pill | `rounded-full px-2.5 py-0.5 text-xs font-semibold` + icon 13px; màu theo trạng thái (mint = xong, tím = đang duyệt, xanh dương = sẵn sàng, xám = khóa, amber = chờ). |
| Live dot | `h-2 w-2 rounded-full bg-mp-mint-150 animate-pulse-dot`. |

## 6. Motion

### 6.1 Easing & spring (`lib/motion.ts`)
```ts
ease.out       = [0.16, 1, 0.3, 1]     // mặc định cho reveal
ease.editorial = [0.22, 1, 0.36, 1]    // card vào
ease.inOut     = [0.65, 0, 0.35, 1]
spring.pill   = { stiffness: 420, damping: 34, mass: 0.9 }  // tab trượt
spring.card   = { stiffness: 260, damping: 24 }             // card hover
spring.magnet = { stiffness: 180, damping: 14, mass: 0.6 }  // nút nam châm
```

### 6.2 Variants
| Tên | hidden → visible | Thời lượng |
|---|---|---|
| `editorialStaggerContainer` | stagger con 0.1s, delay 0.06s | — |
| `editorialTextReveal` | opacity 0, y 36, blur 8px → rõ | 0.8s, ease.out |
| `cardParallaxEnter` | opacity 0, y 38, scale 0.97 → 1 | 0.75s, ease.editorial |
| `badgePop` | opacity 0, scale 0.92, y 12 → 1 | 0.5s, ease.out |

Mẫu chung mỗi section: `initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-60px' }}` trên container stagger; badge dùng `badgePop`, chữ dùng `editorialTextReveal`, card/nút dùng `cardParallaxEnter`. Hero dùng `animate="visible"` (chạy ngay khi tải).

### 6.3 Keyframe Tailwind
`shimmer` 2.4s (vệt sáng nút) · `pulse-dot` 1.6s (chấm live) · `float` 6s · `marquee` 40s · `spin-360` 0.9s · `fade-up` 0.25s · `pop-in` 0.15s.

### 6.4 Smooth scroll (Lenis)
- Cuộn cấp window, `duration: 1.25`, easing `t => Math.min(1, 1.001 - 2^(-10t))`, `smoothWheel: true`, `syncTouch: false`, tự chạy RAF.
- Thêm class `lenis landing-mode` vào `<html>` khi vào trang, gỡ khi rời trang (các trang app khác dùng `body { overflow: hidden }`).
- Tắt `scroll-behavior: smooth` của CSS để không xung đột.
- Trong lúc đang cuộn (`.lenis-scrolling`), tắt pointer-events của card spotlight để giữ 60fps.

## 7. Giọng văn nội dung

- Tiếng Anh, giọng kỹ thuật – tự tin, nhiều thuật ngữ cụ thể và con số ("O(V+E)", "5-state FSM", "12 tables", "HTTP 422").
- Kicker IN HOA, nối ý bằng dấu `·`.
- H1/H2 = mệnh đề hành động + cụm lợi ích gradient ("…with architectural precision.", "…with zero friction.").
- CTA chính: động từ + mũi tên ("Launch Workspace →", "Get Started Free"); CTA phụ: "Explore … Demo".

## 8. Checklist áp dụng cho dự án mới

1. Copy `tailwind.config.js` phần `colors.mp`, `boxShadow`, `keyframes`, `animation`. Có thể đổi tên namespace `mp` và thay 2 màu thương hiệu (purple-150, coral); giữ nguyên thang trung tính ấm.
2. Copy `lib/motion.ts`, `SmoothScrollProvider`, `MagneticButton`, `SmoothTabSwitcher`, `MixpanelBentoCard`, `CountUp`.
3. Nạp font Inter.
4. Dựng 6 section theo mục 4; viết lại nội dung theo mục 7.
5. Thiết kế lại mock UI hero và mock UI từng tab cho đúng sản phẩm mới — đây là phần tạo khác biệt, không copy nội dung DAG/Kanban.
6. Kiểm tra: mobile 375px không cuộn ngang, `prefers-reduced-motion` tắt hiệu ứng, tab cuộn ngang được trên mobile.
