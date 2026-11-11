# A1 — Hạ tầng build, test và CI chung

Người làm: A
Người review: B
Trạng thái: chưa làm
Cần có trước: T0
Cần trước bước frontend: không
Mở khóa: A3
Nhánh git: a1-build-ci
Ước lượng: 0,5–1 ngày

## Vì sao cần task này
- Chưa chạy được test backend bằng dòng lệnh: có `wpe-backend/.mvn/wrapper/maven-wrapper.properties` (chưa commit) nhưng thiếu `mvnw` và `mvnw.cmd`. Máy của nhóm cũng chưa cài Maven.
- 4 người code song song mà không có CI thì PR làm hỏng code người khác sẽ không ai biết.
- 4 người cùng tạo migration Flyway thì dễ lệch thứ tự (xem README mục 6.2).

## Kiến thức phải nắm
- Maven lifecycle (compile, test, package). Maven Wrapper là gì, vì sao nên có.
- Test Spring Boot: `@WebMvcTest` và `@ExtendWith(MockitoExtension.class)` (dự án dùng cả hai, chưa có `@SpringBootTest`).
- Flyway: bảng `flyway_schema_history`, vì sao không được sửa migration đã chạy, `out-of-order`.
- GitHub Actions: workflow, job, step, trigger `pull_request`.

## Bước 0 — Tự đọc, không dùng AI
Đọc: `docs/TEAM_DEVELOPMENT_GUIDE.md` (phần Flyway và FAQ), `wpe-backend/pom.xml`, `wpe-backend/.mvn/wrapper/maven-wrapper.properties`, mục `spring.flyway` trong `wpe-backend/src/main/resources/application.yml`, cùng 2 file test bất kỳ trong `wpe-backend/src/test/`.
Trả lời vào "Ghi chép của người làm":
1. `distributionType=only-script` nghĩa là gì? Vì sao thiếu `mvnw` thì không chạy được?
2. `@WebMvcTest(NodeController.class)` khởi động những gì và không khởi động những gì? Vì sao test kiểu này không cần PostgreSQL?
3. Kể một tình huống 2 người cùng tạo migration làm Flyway báo lỗi. `out-of-order: true` giải quyết thế nào, đánh đổi gì?

## Được đọc
> Viết tắt: `BE/` = `wpe-backend/src/main/java/com/pipeline/wpe/`, `BE-test/` = `wpe-backend/src/test/java/com/pipeline/wpe/`, `FE/` = `wpe-frontend/src/`.
- `docs/TEAM_DEVELOPMENT_GUIDE.md`
- `wpe-backend/pom.xml`, `wpe-backend/.mvn/**`, `wpe-backend/src/**`
- `wpe-frontend/package.json`

## Được ghi
- `wpe-backend/mvnw`, `wpe-backend/mvnw.cmd`, `wpe-backend/.mvn/wrapper/maven-wrapper.properties`
- `wpe-backend/src/main/resources/application.yml` (chỉ mục `spring.flyway`)
- `.github/workflows/ci.yml` (mới)
- `docs/TEAM_DEVELOPMENT_GUIDE.md` (thêm mục "Chạy test bằng dòng lệnh")
- `docs/tasks/A-tai-khoan/A1-ha-tang-build-ci.md`

## Đặc tả đã chốt
- Wrapper: giữ đúng phiên bản Maven đang ghi trong `maven-wrapper.properties`. Tạo `mvnw` và `mvnw.cmd` bằng goal `wrapper:wrapper`. Nếu máy có Maven: `mvn -N wrapper:wrapper -Dtype=only-script`. Nếu không: dùng Maven có sẵn trong IntelliJ (cửa sổ Maven → Execute Maven Goal).
- `application.yml`: thêm `spring.flyway.out-of-order: true`, kèm comment ghi rõ chỉ dùng cho giai đoạn dev khi 4 người làm song song.
- CI chạy khi có `pull_request` hoặc `push` lên `main`:
  - job `backend`: `actions/setup-java` (temurin 17, cache maven), chạy `./mvnw -B test` trong `wpe-backend`.
  - job `frontend`: `actions/setup-node` (Node 20, cache npm), chạy `npm ci`, `npm run typecheck`, `npm test` trong `wpe-frontend`.
- Không `skip` test đang lỗi. Gặp test lỗi thì ghi vào báo cáo, nêu thuộc mảng ai, rồi báo người đó.
- Workflow không chứa secret nào.

## Việc cần làm
1. 🧠 Bước 0, trả lời 3 câu.
2. 🤝 Tạo wrapper. Chạy `cd wpe-backend && ./mvnw -v` rồi `./mvnw test` (Windows dùng `mvnw.cmd test`). Dán dòng `Tests run: …` thật vào ghi chép.
3. 🧠 Nếu có test lỗi: tự đọc stack trace, ghi nguyên nhân bạn đoán và test đó thuộc mảng ai. Không sửa logic của mảng khác.
4. 🤝 Thêm `out-of-order` vào `application.yml`.
5. 🤝 Viết `.github/workflows/ci.yml`. 🧠 Tự giải thích từng khối của workflow trong ghi chép: job chạy ở đâu, cache để làm gì.
6. 🤝 Thêm mục "Chạy test bằng dòng lệnh" vào `docs/TEAM_DEVELOPMENT_GUIDE.md`: lệnh BE, lệnh FE, cách đọc báo cáo trong `wpe-backend/target/surefire-reports`.
7. Mở PR, xem CI chạy trên GitHub, dán link lần chạy vào ghi chép.

## Tiêu chí xong
- [ ] `cd wpe-backend && ./mvnw -B test` chạy được trên máy A (dán dòng `Tests run:` thật).
- [ ] `mvnw`, `mvnw.cmd` và `.mvn/wrapper/maven-wrapper.properties` có trong commit.
- [ ] CI chạy trên PR, cả 2 job `backend` và `frontend` đều chạy. Job nào đỏ thì ghi chép phải nêu test nào, thuộc mảng ai, đã báo ai.
- [ ] `application.yml` có `out-of-order: true` kèm comment.
- [ ] Hướng dẫn chạy test có trong `docs/TEAM_DEVELOPMENT_GUIDE.md`.

## Câu hỏi bảo vệ (người review hỏi, trả lời không nhìn code)
1. Vì sao CI chạy được test backend mà không cần PostgreSQL? Sau này có test `@SpringBootTest` cần DB thì CI phải thêm gì?
2. Một bạn sửa file V2 đã chạy rồi. Chuyện gì xảy ra khi người khác chạy app? Cách sửa đúng là gì?
3. `npm ci` khác `npm install` ở đâu? Vì sao CI dùng `npm ci`?

## Cấm
- Sửa file ngoài mục "Được ghi". File dùng chung thì báo nhóm trước (README mục 6).
- Đọc, in, commit `.env*`, khóa, mật khẩu thật, API key. Dùng `git add -f`.
- Sửa migration đã có (V1–V4, và migration người khác đã merge).
- Tự ghi trạng thái `xong`. Chỉ người review ghi sau khi kiểm.

## Dành cho Claude (đọc trước khi làm)
Người dán file này là **người làm** task. Mục tiêu kép: task chạy đúng **và** người làm hiểu hết những gì đã làm.
1. Chưa sửa code vội. Yêu cầu người làm tóm tắt mục tiêu task và đọc câu trả lời Bước 0 của họ. Sai hoặc thiếu thì giải thích, rồi hỏi lại.
2. Bước 🧠: không viết hộ. Chỉ gợi ý, đặt câu hỏi dẫn dắt, chỉ chỗ sai.
3. Bước 🤝: làm từng phần nhỏ. Mỗi phần nói rõ sửa file nào, vì sao, chạy kiểm thế nào. Yêu cầu người làm tự chạy lệnh và đọc kết quả.
4. Chỉ sửa file trong "Được ghi". Cần đụng file khác, nhất là file dùng chung, thì dừng lại và nói lý do để người làm hỏi nhóm.
5. "Đặc tả đã chốt" là quyết định của nhóm, không tự đổi. Thấy đặc tả sai thì báo ra, không tự làm theo ý mình.
6. Không đọc hay in `.env*`, khóa, mật khẩu, API key.
7. Làm xong: hỏi người làm 3 câu trong "Câu hỏi bảo vệ", nhắc họ điền ghi chép bằng lời của họ, chỉ đổi trạng thái thành `chờ kiểm`.

## Ghi chép của người làm
> Viết bằng lời của bạn. Người review đọc phần này trước khi đọc code.

### Trả lời Bước 0

### Đã làm gì (file nào, vì sao)

### Kết quả test (dán output thật, không chép tay)

### Điều chưa chắc / cần nhóm quyết

## Nhật ký sprint (chế độ làm nhanh — xem `docs/tasks/SPRINT_2_NGAY.md`)
Đã học lại: chưa

- **Làm gì:**
- **File chính đã sửa:**
- **Vì sao làm vậy** (tự viết):
- **Cần học lại:**
