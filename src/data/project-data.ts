export interface CreditEntry {
    role: string;
    names: string;
}

export interface ProjectMetaData {
    id: string;
    type: 'animation' | 'mv' | 'series';
    title: string;
    description_1: string;
    description_2: string;
    firstAired: string;
    customTag?: {label: string; value: string}[];
    /** Display names for each character, in order. Length drives the number of character rows. */
    characters: string[];
    /** How many color-script images exist (color-script-1.png … color-script-N.png). Default: 12 */
    colorScriptCount?: number;
    /**
     * Ordered list of background media. Each entry declares its type so the grid
     * can render images (.webp) and videos (.webm) in the same grid without guessing.
     * Files must be named background-1.webp / background-1.webm etc. matching the index.
     * Defaults to 4 static images when omitted.
     */
    backgrounds?: {type: 'image' | 'video'}[];
    credits: CreditEntry[];
}

export const PROJECTS: Record<string, ProjectMetaData> = {
    "ngoc-bao-khi": {
        id: "ngoc-bao-khi",
        type: 'animation',
        title: "NGỌC BẢO KHÍ",
        description_1: `
            Ngọc Bảo Khí là dự án hoạt hình ngắn được đội ngũ SiNo Studio thực hiện ngay sau
            teaser LINH: Truy Hồn Âm Giới. Đây là một bước tiến quan trọng của team, đánh dấu
            sự trưởng thành rõ rệt về mặt kỹ thuật và tư duy sản xuất.
        `,
        description_2: `
            Không phải một dự án series, Ngọc Bảo Khí đơn thuần là lời khẳng định cho sự
            nghiêm túc, bền bỉ và định hướng lâu dài của SiNo Studio trên con đường sáng tạo
            phía trước.
        `,
        firstAired: "19 THÁNG 1, 2026",
        characters: ['LONG', 'BOSS'],
        backgrounds: [
            {type: 'video'},
            {type: 'video'},
            {type: 'video'},
            {type: 'video'},
            {type: 'image'},
            {type: 'image'},
            {type: 'image'},
            {type: 'image'},
        ],
        credits: [
            {role: 'DIRECTOR', names: 'VU SINO'},
            {role: 'ART DIRECTOR', names: 'TRUONG HANH'},
            {role: 'ANIMATION DIRECTOR', names: 'HUNG NOMI'},
            {role: 'CHARACTER DESIGN', names: 'TRAN QUYNH THU, VU SINO, LO MI'},
            {role: 'SFX ARTIST', names: 'PEE PEE'},
            {role: 'MIXING, MASTERING & SOUNDTRACK', names: 'HOANG JEMI'},
            {role: 'ANIMATORS', names: 'ANH KHANG, VAN PHU, TRUONG HUY, HOANG DAI NGOC, CONGEE, TOKKI'},
            {role: 'LAYOUT & BACKGROUND ARTISTS', names: 'TRAN LE ANH, TRUNG BA, NGUYEN THANG, TOAN PHAM'},
            {role: '3D ARTISTS', names: 'NGUYEN HOANG KHANG, TRUNG BA, DAO GIA PHONG, QUYNH NGUYEN, LE NGOC DO'},
            {role: 'VOICE CAST', names: 'THANH KHANG'},
            {role: 'SAKKAN', names: 'HOANG DAI NGOC, TRAN QUYNH THU, TOKKI'},
            {role: 'COMPOSITING ARTISTS', names: 'OUTLASTZEDD, DATTO, MOFU'},
        ]
    },
    "linh-truy-hon-am-gioi": {
        id: "linh-truy-hon-am-gioi",
        type: 'animation',
        title: "LINH: TRUY HỒN ÂM GIỚI",
        description_1: `
            Ngọc Bảo Khí là dự án hoạt hình ngắn được đội ngũ SiNo Studio thực hiện ngay sau
            teaser LINH: Truy Hồn Âm Giới. Đây là một bước tiến quan trọng của team, đánh dấu
            sự trưởng thành rõ rệt về mặt kỹ thuật và tư duy sản xuất.
        `,
        description_2: `
            Không phải một dự án series, Ngọc Bảo Khí đơn thuần là lời khẳng định cho sự
            nghiêm túc, bền bỉ và định hướng lâu dài của SiNo Studio trên con đường sáng tạo
            phía trước.
        `,
        firstAired: "19 THÁNG 1, 2026",
        characters: ['LINH', 'MA BÀ ĐỒNG'],
        credits: [
            {role: 'DIRECTOR', names: 'VU SINO'},
            {role: 'ART DIRECTOR', names: 'TRUONG HANH'},
            {role: 'ANIMATION DIRECTOR', names: 'HUNG NOMI'},
            {role: 'CHARACTER DESIGN', names: 'TRAN QUYNH THU, VU SINO, LO MI'},
            {role: 'SFX ARTIST', names: 'PEE PEE'},
            {role: 'MIXING, MASTERING & SOUNDTRACK', names: 'HOANG JEMI'},
            {role: 'ANIMATORS', names: 'ANH KHANG, VAN PHU, TRUONG HUY, HOANG DAI NGOC, CONGEE, TOKKI'},
            {role: 'LAYOUT & BACKGROUND ARTISTS', names: 'TRAN LE ANH, TRUNG BA, NGUYEN THANG, TOAN PHAM'},
            {role: '3D ARTISTS', names: 'NGUYEN HOANG KHANG, TRUNG BA, DAO GIA PHONG, QUYNH NGUYEN, LE NGOC DO'},
            {role: 'VOICE CAST', names: 'THANH KHANG'},
            {role: 'SAKKAN', names: 'HOANG DAI NGOC, TRAN QUYNH THU, TOKKI'},
            {role: 'COMPOSITING ARTISTS', names: 'OUTLASTZEDD, DATTO, MOFU'},
        ]
    },
    "tet-lien-quan-2026": {
        id: "tet-lien-quan-2026",
        type: 'animation',
        title: "TẾT LIÊN QUÂN 2026",
        description_1: `
            Sino Studio đã tái hiện thành công không khí ngày Tết trong thế giới Liên Quân Mobile thông qua phong cách hội họa hoàn toàn mới và quy trình thiết kế nhân vật có độ khó cao. Dù yêu cầu về kỹ thuật phức tạp, đội ngũ đã chứng minh năng lực sản xuất tối ưu khi hoàn thiện dự án chỉ trong vòng 01 tháng. 
        `,
        description_2: `
            Ngay sau khi ra mắt trên fanpage chính thức, sản phẩm đã nhận được sự ủng hộ mạnh mẽ từ cộng đồng, khẳng định vị thế của studio trong việc triển khai các sản phẩm truyền thông hoạt hình chất lượng cao.
        `,
        firstAired: "31 THÁNG 1, 2026",
        customTag: [{label: 'KHÁCH HÀNG', value: 'GARENA'}],
        characters: ['MURAD', 'LINH BẢO', 'TÀ THẦN'],
        colorScriptCount: 6,
        credits: [
            {role: 'DIRECTOR', names: 'VU SINO'},
            {role: 'ART DIRECTOR', names: 'TRUONG HANH'},
            {role: 'CHARACTER DESIGN', names: 'TRAN QUYNH THU, TRUONG HUY, GIA HUY'},
            {role: 'ANIMATORS', names: 'ANH KHANG, VAN PHU, TRUONG HUY, CONGEE, TOKKI, MINH TUAN, LO MI, JED PANULIN, THANH VAN, TOFU, ALPHA TECHNIME'},
            {role: 'LAYOUT & BACKGROUND ARTISTS', names: 'TRUONG HANH, TRUNG BA, QUYT, NGOC ANH'},
            {role: 'SAKKAN', names: 'TRAN QUYNH THU'},
            {role: 'SFX ARTIST', names: 'PEE PEE, DINH HUY, VU SINO'},
            {role: 'MIXING, MASTERING & SOUNDTRACK', names: 'HOANG JEMI'},
            {role: 'COMPOSITING ARTISTS', names: 'OUTLASTZEDD, 高橋 幸福'},
        ]
    },
    "chang-trai-bat-tinh": {
        id: "chang-trai-bat-tinh",
        type: 'animation',
        title: "LINH: TRUY HỒN ÂM GIỚI",
        description_1: `
            Ngọc Bảo Khí là dự án hoạt hình ngắn được đội ngũ SiNo Studio thực hiện ngay sau
            teaser LINH: Truy Hồn Âm Giới. Đây là một bước tiến quan trọng của team, đánh dấu
            sự trưởng thành rõ rệt về mặt kỹ thuật và tư duy sản xuất.
        `,
        description_2: `
            Không phải một dự án series, Ngọc Bảo Khí đơn thuần là lời khẳng định cho sự
            nghiêm túc, bền bỉ và định hướng lâu dài của SiNo Studio trên con đường sáng tạo
            phía trước.
        `,
        firstAired: "JANUARY 19, 2026",

        characters: ['LINH', 'MA BÀ ĐỒNG'],
        credits: [
            {role: 'DIRECTOR', names: 'VU SINO'},
            {role: 'ART DIRECTOR', names: 'TRƯỜNG HẠNH'},
            {role: 'ANIMATION DIRECTOR', names: 'HUNG NOMI'},
            {role: 'CHARACTER DESIGN', names: 'TRAN QUYNH THU, VU SINO, LO MI'},
            {role: 'SFX ARTIST', names: 'PEE PEE'},
            {role: 'MIXING, MASTERING & SOUNDTRACK', names: 'HOANG JEMI'},
            {role: 'ANIMATORS', names: 'ANH KHANG, VAN PHU, TRUONG HUY, HOANG DAI NGOC, CONGEE, TOKKI'},
            {role: 'LAYOUT & BACKGROUND ARTISTS', names: 'TRAN LE ANH, TRUNG BA, NGUYEN THANG, TOAN PHAM'},
            {role: '3D ARTISTS', names: 'NGUYEN HOANG KHANG, TRUNG BA, DAO GIA PHONG, QUYNH NGUYEN, LE NGOC DO'},
            {role: 'VOICE CAST', names: 'THANH KHANG'},
            {role: 'SAKKAN', names: 'HOANG DAI NGOC, TRAN QUYNH THU, TOKKI'},
            {role: 'COMPOSITING ARTISTS', names: 'OUTLASTZEDD, DATTO, MOFU'},
        ]
    },
    "yeu-trong-co-doc": {
        id: "yeu-trong-co-doc",
        type: 'animation',
        title: "LINH: TRUY HỒN ÂM GIỚI",
        description_1: `
            Ngọc Bảo Khí là dự án hoạt hình ngắn được đội ngũ SiNo Studio thực hiện ngay sau
            teaser LINH: Truy Hồn Âm Giới. Đây là một bước tiến quan trọng của team, đánh dấu
            sự trưởng thành rõ rệt về mặt kỹ thuật và tư duy sản xuất.
        `,
        description_2: `
            Không phải một dự án series, Ngọc Bảo Khí đơn thuần là lời khẳng định cho sự
            nghiêm túc, bền bỉ và định hướng lâu dài của SiNo Studio trên con đường sáng tạo
            phía trước.
        `,
        firstAired: "JANUARY 19, 2026",

        characters: ['LINH', 'MA BÀ ĐỒNG'],
        credits: [
            {role: 'DIRECTOR', names: 'VU SINO'},
            {role: 'ART DIRECTOR', names: 'TRƯỜNG HẠNH'},
            {role: 'ANIMATION DIRECTOR', names: 'HUNG NOMI'},
            {role: 'CHARACTER DESIGN', names: 'TRAN QUYNH THU, VU SINO, LO MI'},
            {role: 'SFX ARTIST', names: 'PEE PEE'},
            {role: 'MIXING, MASTERING & SOUNDTRACK', names: 'HOANG JEMI'},
            {role: 'ANIMATORS', names: 'ANH KHANG, VAN PHU, TRUONG HUY, HOANG DAI NGOC, CONGEE, TOKKI'},
            {role: 'LAYOUT & BACKGROUND ARTISTS', names: 'TRAN LE ANH, TRUNG BA, NGUYEN THANG, TOAN PHAM'},
            {role: '3D ARTISTS', names: 'NGUYEN HOANG KHANG, TRUNG BA, DAO GIA PHONG, QUYNH NGUYEN, LE NGOC DO'},
            {role: 'VOICE CAST', names: 'THANH KHANG'},
            {role: 'SAKKAN', names: 'HOANG DAI NGOC, TRAN QUYNH THU, TOKKI'},
            {role: 'COMPOSITING ARTISTS', names: 'OUTLASTZEDD, DATTO, MOFU'},
        ]
    },
    "tay-du-ki-gen-z": {
        id: "tay-du-ki-gen-z",
        type: 'animation',
        title: "LINH: TRUY HỒN ÂM GIỚI",
        description_1: `
            Ngọc Bảo Khí là dự án hoạt hình ngắn được đội ngũ SiNo Studio thực hiện ngay sau
            teaser LINH: Truy Hồn Âm Giới. Đây là một bước tiến quan trọng của team, đánh dấu
            sự trưởng thành rõ rệt về mặt kỹ thuật và tư duy sản xuất.
        `,
        description_2: `
            Không phải một dự án series, Ngọc Bảo Khí đơn thuần là lời khẳng định cho sự
            nghiêm túc, bền bỉ và định hướng lâu dài của SiNo Studio trên con đường sáng tạo
            phía trước.
        `,
        firstAired: "JANUARY 19, 2026",

        characters: ['LINH', 'MA BÀ ĐỒNG'],
        credits: [
            {role: 'DIRECTOR', names: 'VU SINO'},
            {role: 'ART DIRECTOR', names: 'TRƯỜNG HẠNH'},
            {role: 'ANIMATION DIRECTOR', names: 'HUNG NOMI'},
            {role: 'CHARACTER DESIGN', names: 'TRAN QUYNH THU, VU SINO, LO MI'},
            {role: 'SFX ARTIST', names: 'PEE PEE'},
            {role: 'MIXING, MASTERING & SOUNDTRACK', names: 'HOANG JEMI'},
            {role: 'ANIMATORS', names: 'ANH KHANG, VAN PHU, TRUONG HUY, HOANG DAI NGOC, CONGEE, TOKKI'},
            {role: 'LAYOUT & BACKGROUND ARTISTS', names: 'TRAN LE ANH, TRUNG BA, NGUYEN THANG, TOAN PHAM'},
            {role: '3D ARTISTS', names: 'NGUYEN HOANG KHANG, TRUNG BA, DAO GIA PHONG, QUYNH NGUYEN, LE NGOC DO'},
            {role: 'VOICE CAST', names: 'THANH KHANG'},
            {role: 'SAKKAN', names: 'HOANG DAI NGOC, TRAN QUYNH THU, TOKKI'},
            {role: 'COMPOSITING ARTISTS', names: 'OUTLASTZEDD, DATTO, MOFU'},
        ]
    },
}