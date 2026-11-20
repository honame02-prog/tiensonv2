# GD5: Cot Linh Lanh Hoa top-down trong game

- Cue `src/fx/cues/cot-linh-td.json` (2,5 s): 3 track anim at=0 (atlas `cotlinh-td-floor|back|front`, layer `ground|behind|front`), light ADD bang (rx 44, ry 22) 0,5 -> 1,8 dinh 1,10, nhap 1,30 / 1,52, tint muc tieu 1,10 -> 1,75, shake 1,10 va 1,75, hitstop 50 ms 1,75, emitter bui bang + tuyet 1,75, event `freeze` 1,10, `hit` 1,75.
- Xuat atlas (repo skillfx): `node tools/phaser-atlas.mjs di-hoa/cot-linh-td --out ../tiensonv2/public/assets/fx --name cotlinh-td-<part> --opts '{"part":"<part>"}'` (floor, back, front); tong PNG ~139 KB; moi atlas 76 khung (75 + khung cuoi). Tag = name nen khong trung anim key.
- FxPlayer: `layer` them `behind` (depth y-1) va `front` (y+1); track `tint` (`opts.target`). Xem design/tienson/02-fxplayer-api.md.
- Demo `?fx=1`: phim 6 / nut 6 (`__fxdemo.castTd()`) tao hinh nom (sprite Dao Si idle_down to cam, dung truoc mat Dao Si 56 px theo huong nhin) va phat cue dung chan nom.
- Test: `npm run build` roi `node tools/gd5_test.mjs` (tu bat preview cong 8096). Anh shots/gd5_hit.png (~1,3 s), shots/gd5_burst.png (chup luc ~1,9-2,0 s do do tre chup anh swiftshader).

## Gioi han
- Chua ghep vao ky nang that / sat thuong: chi demo ?fx=1. Event `freeze`/`hit` do game goi onEvent tu xu ly.
- Hinh nom khong co bong; tint bang la nhan mau (multiply), mau goc cua muc tieu bi toi hon luc dong bang.
- Hitstop 50 ms dung toan bo anim/tween (ke ca sprite FX) theo thiet ke chung.
- Test gd5 bo qua canh bao `CONTEXT_LOST_WEBGL: loseContext` luc khoi dong (co san, swiftshader) va nhieu hieu nang `GL Driver Message`.
- FPS do tren swiftshader headless (khong phai GPU that, chua do mobile).

## GD5-center: moi chieu phat dung tam hinh nom
- Hinh nom (`__fxdemo.dummy`) luon co ngay khi vao `?fx=1`; phim/nut 1-6 deu phat tai chan nom (4 = 3 cue quanh nom, ban kinh 40; 5 = vu no vao than nom, y = chan - 28). Nom chi dat lai khi Dao Si cach > 100 px hoac < 24 px.
- Nguyen nhan lech: cue 1-5 truoc day dat o diem cach hero 36 px / chan hero; atlas vocab-strike co pivot = chan nguoi ra don, vu no cach pivot ~(+57, -25) nen lech phai ~57 px.
- Cach tong quat: atlas JSON co `meta.impact {x,y}` (px nguon; xuat bang `phaser-atlas.mjs ... --impact 101,75`; vocab-strike da them tay cung gia tri, khong doi PNG); track anim trong cue dat `"anchor": "impact"` thi FxPlayer lay origin = impact/sourceSize (originX/originY trong cue van uu tien nhat; khong co anchor hoac khong co impact thi dung pivot nhu cu).
- Test: `npm run build` roi `node tools/center_test.mjs` (preview cong 8098; do lech x tam chieu so voi nom <= 2 px, anh shots/center_1..6.png); `node tools/center_measure.mjs` in toa do tho. gd4_test sua 2 dong (origin = impact, vi tri = than nom) theo hanh vi moi.

## GD6: Thanh Lien Dia Tam Hoa top-down (phim 7)
- Cue `src/fx/cues/thanh-lien-td.json` (2,5 s): 3 track anim at=0 (atlas `thanhlien-td-floor|back|front`, layer `ground|behind|front`), light ADD luc 0,30 -> 1,72 -> 2,30 (rx 50, ry 25; mau hex dai thanhlien, khong dung ramp), nhap 0,98 / 1,16, shake 0,30 va 1,72, hitstop 50 ms 1,72, emitter tan lua 1,72, event `hit` 1,72. Khong co track tint.
- Xuat atlas (repo skillfx): `node tools/phaser-atlas.mjs di-hoa/thanh-lien-td --out ../tiensonv2/public/assets/fx --name thanhlien-td-<part> --opts '{"part":"<part>"}'` (floor, back, front). 76 khung moi atlas; pivot (112,146) / sourceSize 224x200. PNG: floor 1020x710 (86851 B), back 246x1890 (49481 B), front 992x438 (41140 B).
- Bang mau: them dai `thanhlien` (7 mau ngoc bich #031d29 #07545b #0c9b88 #24d9a1 #7afbc6 #caffed #ffffff) vao `art/palette/tienson-fx.gpl` (va ban sao `tienson/art/palette/tienson-fx.gpl`, giong het). KHONG chay lai gpl_to_json (fx-palette.json giu nguyen), KHONG xuat lai cotlinh-td / vocab-strike (snap lai co the doi mau).
- Kiem mau atlas: 398.726 pixel duc, 100,00 % thuoc dai thanhlien, 0 pixel thuoc dai moc (xanh co).
- Test: `npm run build` roi `node tools/gd6_test.mjs` (cong 8097). Anh shots/gd6_bloom.png (~1,35 s), gd6_column.png (~1,95 s), gd6_fade.png (~2,4 s). Phim 7 / nut 7 = `__fxdemo.castTl()`.
- FPS swiftshader luc nay ~48-50 (gd5_test cu cung ~48 luc do) do may ban, nguong 55 khong dat o ca hai test; khong do tren GPU that.
