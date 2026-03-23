export interface CreditEntry {
    role: string;
    names: string;
}

/**
 * All available section components that can be rendered in ProjectShowcasePage.
 *
 * Animation sections:  color-script | characters | background | credits
 * MV sections:         snippets | lyrics | video | credits
 * (MV sections are not yet implemented — placeholders for future use)
 */
export type ProjectSection =
    | 'color-script'
    | 'characters'
    | 'background'
    | 'credits'
    | 'snippets'
    | 'fanart'
    | 'video';

export interface ProjectMetaData {
    id: string;
    type: 'animation' | 'mv' | 'series' | 'tvc';
    title: string;
    description_1: string;
    description_2?: string;
    firstAired: string;
    customTags?: {label: string; value: string}[];
    /** Display names for each character, in order. Length drives the number of character rows. */
    characters?: string[];
    /** How many color-script images exist (color-script-1.png … color-script-N.png). Default: 12 */
    colorScriptCount?: number;
    /** How many snippet images exist (snippets-1.webp … snippets-N.webp). Default: 12 */
    snippetsCount?: number;
    /** How many fanart images exist (fanart-1.webp … fanart-N.webp). Default: 12 */
    fanartCount?: number;
    /** Per-image dimensions for react-photo-album. Falls back to a cycling default pattern if omitted. */
    fanartDimensions?: Array<{ w: number; h: number }>;
    /**
     * Ordered list of background media. Each entry declares its type so the grid
     * can render images (.webp) and videos (.webm) in the same grid without guessing.
     * Files must be named background-1.webp / background-1.webm etc. matching the index.
     * Defaults to 4 static images when omitted.
     */
    backgrounds?: {type: 'image' | 'video'}[];
    /**
     * Ordered list of section components to render in ProjectShowcasePage.
     * This drives both the page layout and the section nav links in Hero.
     */
    sections: ProjectSection[];
    /** For MV projects: optional song lyrics to display alongside video. */
    lyrics?: string;
    /**
     * Time-synced lyrics. When present, Video renders an animated karaoke view instead
     * of the static <pre> block. Falls back to `lyrics` if absent.
     * `t` = seconds from the start of the YouTube video.
     */
    syncedLyrics?: { t: number; line: string }[];
    /** YouTube video ID (e.g. "dQw4w9WgXcQ") used by the Video section component. */
    youtubeId?: string;
    videoStats?: {label: string; value: string, color: string}[];
    credits: CreditEntry[];
}

export const PROJECTS: Record<string, ProjectMetaData> = {
    "ngoc-bao-khi": {
        id: "ngoc-bao-khi",
        type: 'animation',
        title: "NGỌC BẢO KHÍ",
        description_1: `
            Ngọc Bảo Khí là dự án hoạt hình ngắn được đội ngũ Sino Studio thực hiện ngay sau
            teaser LINH: Truy Hồn Âm Giới. Đây là một bước tiến quan trọng của team, đánh dấu
            sự trưởng thành rõ rệt về mặt kỹ thuật và tư duy sản xuất.
        `,
        description_2: `
            Không phải một dự án series, Ngọc Bảo Khí đơn thuần là lời khẳng định cho sự
            nghiêm túc, bền bỉ và định hướng lâu dài của Sino Studio trên con đường sáng tạo
            phía trước.
        `,
        firstAired: "19 THÁNG 1, 2026",
        characters: ['LONG', 'BOSS'],
        sections: ['color-script', 'characters', 'background', 'credits'],
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
            {role: 'DIRECTOR', names: 'VŨ SINO'},
            {role: 'ART DIRECTOR', names: 'TRƯƠNG HẠNH'},
            {role: 'ANIMATION DIRECTOR', names: 'HƯNG NOMI'},
            {role: 'CHARACTER DESIGN', names: 'TRẦN QUỲNH THƯ, VŨ SINO, LÔ MI'},
            {role: 'SFX ARTIST', names: 'PEE PEE'},
            {role: 'MIXING, MASTERING & SOUNDTRACK', names: 'HOÀNG JEMI'},
            {role: 'ANIMATOR', names: 'ANH KHANG, VĂN PHÚ, TRƯƠNG HUY, HOÀNG ĐẠI NGỌC, BANANA, TOKKI'},
            {role: 'LAYOUT & BACKGROUND ARTIST', names: 'TRẦN LÊ ANH, TRUNG BÁ, NGUYỄN THẮNG, TOÀN PHẠM'},
            {role: '3D ARTIST', names: 'NGUYỄN HOÀNG KHANG, TRUNG BÁ, ĐÀO GIA PHONG, QUỲNH NGUYỄN, LÊ NGỌC ĐÔ'},
            {role: 'VOICE CAST', names: 'THANH KHANG'},
            {role: 'SAKKAN', names: 'HOÀNG ĐẠI NGỌC, TRẦN QUỲNH THƯ, TOKKI'},
            {role: 'COMPOSITING ARTIST', names: 'OUTLASTZEDD, DATTO, MOFU'},
        ]
    },
    "linh-truy-hon-am-gioi": {
        id: "linh-truy-hon-am-gioi",
        type: 'animation',
        title: "LINH: TRUY HỒN ÂM GIỚI",
        description_1: `
            Dự án phim được lấy cảm hứng từ văn hóa và yếu tố tâm linh của Việt Nam. Với một vũ trụ tâm linh vừa mới mẻ vừa quen thuộc, những câu chuyện sâu sắc và hình ảnh hoạt họa đẹp mắt, gần gũi với giới trẻ, dự án kì vọng sẽ là sự đột phát trong nền hoạt hình Việt Nam.
        `,
        firstAired: "2028",
        customTags: [{label: 'THỂ LOẠI', value: 'FANTASY'}, {label: 'ĐỘ DÀI', value: '90 PHÚT'}],
        characters: ['LINH', 'MA BÀ ĐỒNG', 'MA XÂY MỘ'],
        sections: ['characters', 'background', 'credits'],
        backgrounds: [
            {type: 'image'},
            {type: 'image'},
            {type: 'image'},
            {type: 'image'},
            {type: 'image'},
            {type: 'image'},
        ],
        colorScriptCount: 6,
        credits: [
            {role: 'DIRECTOR', names: 'VŨ SINO'},
            {role: 'ART DIRECTOR', names: 'RAITO'},
            {role: 'CHARACTER DESIGN', names: 'TRẦN QUỲNH THƯ, VŨ SINO, LÔ MI, HOÀNG ĐẠI NGỌC, NGUYỄN DUY HƯNG, BÔNG BÔNG'},
            {role: 'ANIMATOR', names: 'ANH KHANG, VĂN PHÚ, HOÀNG ĐẠI NGỌC, TRƯƠNG HUY, TUỆ NHÂN, BANANA, LÔ MI'},
            {role: 'LAYOUT & BACKGROUND ARTIST', names: 'RAITO, PHÚC NGUYỄN, TRẦN LÊ ANH, NGUYỄN CHÍP CHÍP, TRẦN NGỌC ANH, THẮNG NGUYỄN'},
            {role: 'SAKKAN ARTIST', names: 'HOÀNG ĐẠI NGỌC, TRẦN QUỲNH THƯ, GIA HUY'},
            {role: 'COMPOSITING ARTIST', names: 'OUTLASTZEDD, HUYDS'},
            {role: 'SFX ARTIST', names: 'VŨ SINO'},
            {role: 'DESIGN CONSULTANT', names: 'NGHI, BẢO THÁI'},
            {role: 'MIXING, MASTERING & SOUNDTRACK', names: 'OVALKID'},
            {role: 'VOICE CAST', names: 'NGUYỄN THƯ, THANH KHANG, BÚN RIUCUA, TRỌNG NHÂN, CHIẾN KÊ\'S'},
        ]
    },
    "tet-lien-quan-2026": {
        id: "tet-lien-quan-2026",
        type: 'tvc',
        title: "TẾT LIÊN QUÂN 2026",
        description_1: `
            Sino Studio đã tái hiện thành công không khí ngày Tết trong thế giới Liên Quân Mobile thông qua phong cách hội họa hoàn toàn mới và quy trình thiết kế nhân vật có độ khó cao. Dù yêu cầu về kỹ thuật phức tạp, đội ngũ đã chứng minh năng lực sản xuất tối ưu khi hoàn thiện dự án chỉ trong vòng 01 tháng. 
        `,
        description_2: `
            Ngay sau khi ra mắt trên fanpage chính thức, sản phẩm đã nhận được sự ủng hộ mạnh mẽ từ cộng đồng, khẳng định vị thế của studio trong việc triển khai các sản phẩm truyền thông hoạt hình chất lượng cao.
        `,
        firstAired: "31 THÁNG 1, 2026",
        customTags: [{label: 'KHÁCH HÀNG', value: 'GARENA'}],
        characters: ['MURAD', 'LINH BẢO', 'TÀ THẦN'],
        sections: ['color-script', 'characters', 'background', 'video', 'credits'],
        youtubeId: 'xEM42nP20ZQ',
        colorScriptCount: 6,
        credits: [
            {role: 'DIRECTOR', names: 'VŨ SINO'},
            {role: 'ART DIRECTOR', names: 'TRƯƠNG HẠNH'},
            {role: 'CHARACTER DESIGN', names: 'TRẦN QUỲNH THƯ, TRƯƠNG HUY, GIA HUY'},
            {role: 'ANIMATOR', names: 'ANH KHANG, VĂN PHÚ, TRƯƠNG HUY, BANANA, TOKKI, MINH TUẤN, LÔ MI, JED PANULIN, THANH VÂN, TOFU, ALPHA TECHNIME'},
            {role: 'LAYOUT & BACKGROUND ARTIST', names: 'TRƯƠNG HẠNH, TRUNG BÁ, QUÝT, TRẦN NGỌC ANH'},
            {role: 'SAKKAN', names: 'TRẦN QUỲNH THƯ'},
            {role: 'SFX ARTIST', names: 'PEE PEE, HUYDS, VŨ SINO'},
            {role: 'MIXING, MASTERING & SOUNDTRACK', names: 'HOÀNG JEMI'},
            {role: 'COMPOSITING ARTIST', names: 'OUTLASTZEDD, 高橋 幸福'},
        ]
    },
    "chang-trai-bat-tu": {
        id: "chang-trai-bat-tu",
        type: 'mv',
        title: "CHÀNG TRAI BẤT TỬ",
        description_1: `
            Dựa trên câu chuyện có thật, MV kể về mối tình đầy bi thương giữa Hạ và Hiền Lương - hai con người yêu nhau sâu đậm nhưng bị chia cắt bởi căn bệnh hiểm nghèo của chàng trai. Biết thời gian không còn nhiều, họ chọn bên nhau trong những buổi hẹn cuối, không còn giận hờn vì những lần đến muộn, chỉ còn những nụ cười gượng gạo và khoảnh khắc trân quý. Chàng Trai Bất Tử đã lặng lẽ chạm đến trái tim của hàng triệu người bằng chính sự chân thành và nỗi đau rất thật ấy.
        `,
        youtubeId: 'oWENAdVkHRk',
        firstAired: "11 THÁNG 1, 2024",
        sections: ['snippets', 'video', 'fanart', 'credits'],
        lyrics: `🎵
        
Và có lẽ hôm nay là ngày cuối cùng
Anh sẽ không kêu la vì em đến muộn
Đừng khóc như vậy làm anh lo lắng đấy

Anh sẽ lau nước mắt để em mỉm cười
Ta sẽ bên cạnh nhau để ngày sau có nhớ lại
Anh sẽ không thấy ân hận

Anh vẫn muốn được ở bên em lần cuối
Từng giờ từng giây trôi sẽ chỉ có em mà thôi
Nếu sau này em yếu đuối khóc mỗi ngày nhưng không nguôi
Chẳng ai lau giọt nước mắt nhớ đến anh mãi bên cạnh

Có anh đây sẽ ôm em ngày em tệ nhất
Có anh đây sẽ bên em cùng em ngồi mãi trong phòng
Đến khi em đã quên đi tình yêu của ta ngày ấy
Anh sẽ đi đời sau ta gặp lại

Đây là lời nhắn cuối cùng anh viết
Chỉ còn nỗi nhớ kể hoài không xiết
Xin lỗi vì để nỗi buồn ở trong cuộc đời của em

Sau này anh sẽ luôn đợi trong mơ
Nên là đừng thức đêm nhiều em nhớ
Nỗi buồn ngày ấy bây giờ để lại rồi đi tiếp thôi

Anh chưa bao giờ muốn ôm chặt thế này
Anh sợ phải nghĩ đến tim mình đứng lại
Có những điều ta mơ cùng nhau dù chẳng đi được với nhau

Em sẽ phải bước tiếp dẫu mình thế nào
Anh vẫn sẽ ở mãi trong những kỉ niệm
Lời hứa hôm nay đời sau gặp lại

Có anh đây sẽ ôm em ngày em tệ nhất
Có anh đây sẽ bên em cùng em ngồi mãi trong phòng
Đến khi em đã quên đi tình yêu của ta ngày ấy
Anh sẽ đi đời sau ta gặp lại
        `,
        syncedLyrics: [
            {t: 0, line: '🎵'},
            {t: 43, line: 'Và có lẽ hôm nay là ngày cuối cùng'},
            {t: 46.5, line: 'Anh sẽ không kêu la vì em đến muộn'},
            {t: 50.8, line: 'Đừng khóc như vậy làm anh lo lắng đấy'},
            {t: 57.5, line: 'Anh sẽ lau nước mắt để em mỉm cười'},
            {t: 60 + 1, line: 'Ta sẽ bên cạnh nhau để ngày sau có nhớ lại'},
            {t: 60 + 6, line: 'Anh sẽ không thấy ân hận'},
            {t: 60 + 10, line: 'Anh vẫn muốn được ở bên em lần cuối'},
            {t: 60 + 17, line: 'Từng giờ từng giây trôi sẽ chỉ có em mà thôi'},
            {t: 60 + 24.5, line: 'Nếu sau này em yếu đuối khóc mỗi ngày nhưng không nguôi'},
            {t: 60 + 31.7, line: 'Chẳng ai lau giọt nước mắt nhớ đến anh mãi bên cạnh'},
            {t: 60 + 40, line: 'Có anh đây sẽ ôm em ngày em tệ nhất'},
            {t: 60 + 48.5, line: 'Có anh đây sẽ bên em cùng em ngồi mãi trong phòng'},
            {t: 60 + 55.1, line: 'Đến khi em đã quên đi tình yêu của ta ngày ấy'},
            {t: 120 + 2, line: 'Anh sẽ đi đời sau ta gặp lại'},
            {t: 120 + 11.5, line: 'Đây là lời nhắn cuối cùng anh viết'},
            {t: 120 + 15, line: 'Chỉ còn nỗi nhớ kể hoài không xiết'},
            {t: 120 + 18.8, line: 'Xin lỗi vì để nỗi buồn ở trong cuộc đời của em'},
            {t: 120 + 26, line: 'Sau này anh sẽ luôn đợi trong mơ'},
            {t: 120 + 30, line: 'Nên là đừng thức đêm nhiều em nhớ'},
            {t: 120 + 33.8, line: 'Nỗi buồn ngày ấy bây giờ để lại rồi đi tiếp thôi'},
            {t: 120 + 40.9, line: 'Anh chưa bao giờ muốn ôm chặt thế này'},
            {t: 120 + 44.7, line: 'Anh sợ phải nghĩ đến tim mình đứng lại'},
            {t: 120 + 48.5, line: 'Có những điều ta mơ cùng nhau dù chẳng đi được với nhau'},
            {t: 120 + 55.8, line: 'Em sẽ phải bước tiếp dẫu mình thế nào'},
            {t: 120 + 59.5, line: 'Anh vẫn sẽ ở mãi trong những kỉ niệm'},
            {t: 180 + 4.5, line: 'Lời hứa hôm nay đời sau gặp lại'},
            {t: 180 + 8.8, line: 'Có anh đây sẽ ôm em ngày em tệ nhất'},
            {t: 180 + 16, line: 'Có anh đây sẽ bên em cùng em ngồi mãi trong phòng'},
            {t: 180 + 23.4, line: 'Đến khi em đã quên đi tình yêu của ta ngày ấy'},
            {t: 180 + 30.5, line: 'Anh sẽ đi đời sau ta gặp lại'},
        ],
        videoStats: [
            {label: 'YOUTUBE VIEWS', value: '17M+', color: '#e62d2d'},
            {label: 'TIKTOK VIEWS', value: '100M+', color: '#6d41dc'},
            {label: 'SPOTIFY STREAMS', value: '10M+', color: '#55e426'},
        ],
        credits: [
            {role: 'DIRECTOR', names: 'VŨ SINO'},
            {role: 'COMPOSER', names: 'VŨ SINO'},
            {role: 'PERFORMED BY', names: 'AN VŨ'},
            {role: 'SFX ARTIST', names: 'NGHẾCH'},
            {role: 'MIXING, MASTERING & SOUNDTRACK', names: 'MKM'},
            {role: 'ANIMATOR', names: 'VŨ SINO'},
            {role: 'LAYOUT & BACKGROUND ARTIST', names: 'TRẦN NGỌC ANH'},
            {role: 'BACKING VOCAL', names: 'MKM'},
            {role: 'VOICE CAST', names: 'KHANG (HA), HIMA (HIEN LUONG)'},
            {role: 'EDITOR', names: 'OUTLASTZEDD'},
            {role: 'CONSULTANT', names: 'HOÀNG KIỆT KTS'},
            {role: 'MUSIC DISTRIBUTION', names: 'YIN YANG MEDIA'}
        ],
        fanartCount: 6
    },
    "yeu-trong-co-doc": {
        id: "yeu-trong-co-doc",
        type: 'mv',
        title: "YÊU TRONG CÔ ĐỘC",
        description_1: `
            Câu chuyện xoay quanh mối tình chênh lệch danh phận giữa Vũ - chàng xe công nghệ, và Heny - tiểu thư giàu có. Hai tâm hồn cô đơn tìm thấy nhau rồi lạc mất giữa thực tại. Nhiều năm sau, Vũ thành công với âm nhạc, họ gặp lại với tư cách đối tác - khi khoảng cách năm xưa không còn, chỉ còn cơ hội viết tiếp một chuyện tình còn dang dở.
        `,
        firstAired: "28 THÁNG 6, 2024",
        sections: ['snippets', 'video', 'fanart', 'credits'],
        fanartCount: 18,
        youtubeId: 'WN0itED9Iak',
        lyrics: `🎵
        
Ngoài trời là nước mắt rơi tí tách trong vô vọng
Người vội vàng bước đến khiến ta yêu mãi trong cô độc
Đơn phương là thế đó, chỉ vài phút giây thôi mà
Lại làm ta vấn vương?

Lại một lần yếu đuối khi phía trước là bóng người
Ngầm ngùi cứ như, ở ngay trước mắt mà chẳng thể
Chẳng thể nắm lấy đôi bàn tay ấy
Chạy về phía nhau

Ngày em rời đi chẳng nói một câu
Câu rằng em sẽ đi bao lâu sẽ đến bao lâu về lại
Sẽ có những câu chuyện mà anh chẳng thể một lần nhìn lại
Chìm đắm ngay trong cuộc tình cô đơn
Thà em từ chối
Dù là sẽ đau nhưng mà sẽ đau một lần
Và anh sẽ cố quên đi kí ức ngày ấy
Ngày mà người đến cuộc đời anh

Ah
Sau vài lần mình thương lại đau
Chỉ là trái tim nhỏ bé một lần trong đời mình thương hại nhau
Cả nỗi đau rơi từ khóe mắt chắc cũng đã nói thành lời
Điều gì đó vô tình ngăn cản mình lại nên đành vậy thôi
Chơi vơi...siết đi những kí ức thành dòng
Sao hôm đó em không dừng lại một chút để anh hành động
Như đứa trẻ một lần như thế anh lại khóc ngay trong đêm
Không có ngày nào anh được tỉnh táo để mong phút giây trong em
Có lẽ lần cuối gặp nhau là những tin nhắn muộn màng
Gặp được em là điều may mắn mặc dù khoảng cách, thời gian
Nụ cười em vào ngày hôm đó anh mong sẽ không nhớ nữa
Mặc dù anh biết kí ức về em lúc đó là anh có thừa
Lần này nữa thôi, rồi cũng sẽ không còn nữa
Anh xin lần này nữa thôi, anh biết đã mất nhau rồi
Lần này nữa thôi, tim anh cũng không còn lửa
Lần này nữa thôi, xin ta đừng quên nhau vội
Em!

Ngày em rời đi chẳng nói một câu
Câu rằng em sẽ đi bao lâu sẽ đến bao lâu về lại
Sẽ có những câu chuyện mà anh chẳng thể một lần nhìn lại
Chìm đắm ngay trong cuộc tình cô đơn
Thà em từ chối
Dù là sẽ đau nhưng mà sẽ đau một lần
Và anh sẽ cố quên đi kí ức ngày ấy
Ngày mà người đến cuộc đời anh
        `,
        syncedLyrics: [
            {t: 0, line: '🎵'},
            {t: 35, line: 'Ngoài trời là nước mắt rơi tí tách trong vô vọng'},
            {t: 39.9, line: 'Người vội vàng bước đến khiến ta yêu mãi trong cô độc'},
            {t: 45.4, line: 'Đơn phương là thế đó, chỉ vài phút giây thôi mà'},
            {t: 50.2, line: 'Lại làm ta vấn vương?'},
            {t: 56.5, line: 'Lại một lần yếu đuối khi phía trước là bóng người'},
            {t: 60 + 1.5, line: 'Ngầm ngùi cứ như, ở ngay trước mắt mà chẳng thể'},
            {t: 60 + 5.9, line: 'Chẳng thể nắm lấy đôi bàn tay ấy'},
            {t: 60 + 11, line: 'Chạy về phía nhau'},
            {t: 60 + 16.4, line: 'Ngày em rời đi chẳng nói một câu'},
            {t: 60 + 20.9, line: 'Câu rằng em sẽ đi bao lâu sẽ đến bao lâu về lại'},
            {t: 60 + 25.9, line: 'Sẽ có những câu chuyện mà anh chẳng thể một lần nhìn lại'},
            {t: 60 + 31.6, line: 'Chìm đắm ngay trong cuộc tình cô đơn'},
            {t: 60 + 38, line: 'Thà em từ chối'},
            {t: 60 + 41.9, line: 'Dù là sẽ đau nhưng mà sẽ đau một lần'},
            {t: 60 + 47.6, line: 'Và anh sẽ cố quên đi kí ức ngày ấy'},
            {t: 60 + 53, line: 'Ngày mà người đến cuộc đời anh'},
            {t: 120 + 0, line: 'Ah'},
            {t: 120 + 1.9, line: 'Sau vài lần mình thương lại đau'},
            {t: 120 + 3.4, line: 'Chỉ là trái tim nhỏ bé một lần trong đời mình thương hại nhau'},
            {t: 120 + 6.1, line: 'Cả nỗi đau rơi từ khóe mắt chắc cũng đã nói thành lời'},
            {t: 120 + 9, line: 'Điều gì đó vô tình ngăn cản mình lại nên đành vậy thôi'},
            {t: 120 + 11.4, line: 'Chơi vơi...siết đi những kí ức thành dòng'},
            {t: 120 + 14, line: 'Sao hôm đó em không dừng lại một chút để anh hành động'},
            {t: 120 + 16.6, line: 'Như đứa trẻ một lần như thế anh lại khóc ngay trong đêm'},
            {t: 120 + 19.1, line: 'Không có ngày nào anh được tỉnh táo để mong phút giây trong em'},
            {t: 120 + 22.1, line: 'Có lẽ lần cuối gặp nhau là những tin nhắn muộn màng'},
            {t: 120 + 24.9, line: 'Gặp được em là điều may mắn mặc dù khoảng cách, thời gian'},
            {t: 120 + 27.6, line: 'Nụ cười em vào ngày hôm đó anh mong sẽ không nhớ nữa'},
            {t: 120 + 30.1, line: 'Mặc dù anh biết kí ức về em lúc đó là anh có thừa'},
            {t: 120 + 33, line: 'Lần này nữa thôi, rồi cũng sẽ không còn nữa'},
            {t: 120 + 35.6, line: 'Anh xin lần này nữa thôi, anh biết đã mất nhau rồi'},
            {t: 120 + 38.1, line: 'Lần này nữa thôi, tim anh cũng không còn lửa'},
            {t: 120 + 41, line: 'Lần này nữa thôi, xin ta đừng quên nhau vội'},
            {t: 120 + 43.7, line: 'Em!'},
            {t: 120 + 44.6, line: 'Ngày em rời đi chẳng nói một câu'},
            {t: 120 + 48.9, line: 'Câu rằng em sẽ đi bao lâu sẽ đến bao lâu về lại'},
            {t: 120 + 54, line: 'Sẽ có những câu chuyện mà anh chẳng thể một lần nhìn lại'},
            {t: 120 + 59.1, line: 'Chìm đắm ngay trong cuộc tình cô đơn'},
            {t: 180 + 6, line: 'Thà em từ chối'},
            {t: 180 + 10.4, line: 'Dù là sẽ đau nhưng mà sẽ đau một lần'},
            {t: 180 + 15.9, line: 'Và anh sẽ cố quên đi kí ức ngày ấy'},
            {t: 180 + 20.6, line: 'Ngày mà người đến cuộc đời anh'},
            {t: 180 + 26, line: '🎵'}
        ],
        videoStats: [
            {label: 'YOUTUBE VIEWS', value: '800K+', color: '#e62d2d'},
            {label: 'SPOTIFY STREAMS', value: '233K+', color: '#55e426'},
        ],
        credits: [
            {role: 'DIRECTOR', names: 'VŨ SINO'},
            {role: 'COMPOSER', names: 'VŨ SINO'},
            {role: 'PERFORMED BY', names: 'KAI, LIL TIAN'},
            {role: 'SCRIPT WRITER', names: 'VŨ SINO'},
            {role: 'SFX ARTIST', names: 'NGHẾCH'},
            {role: 'MIXING, MASTERING & SOUNDTRACK', names: 'HOÀNG JEMI, KAI'},
            {role: 'ANIMATOR', names: 'VŨ SINO, ANNE, HƯNG NOMI, MÈO'},
            {role: 'LAYOUT & BACKGROUND ARTIST', names: 'TRẦN NGỌC ANH, LIÊN KHÚC CHUI, TRẦN QUỲNH THƯ'},
            {role: 'VOICE CAST', names: 'KHANG (VŨ), CAARM LINH (HENY), DƯƠNG FG (ANH DƯƠNG)'},
            {role: 'CHARACTER DESIGN', names: 'TRẦN QUỲNH THƯ, TRƯƠNG HUY, GIA HUY'},
            {role: 'EDITOR', names: 'OUTLASTZEDD'},
            {role: 'CONSULTANT', names: 'HOÀNG KIỆT KTS, HUYDS'},
            {role: 'MUSIC DISTRIBUTION', names: 'YIN YANG MEDIA'}
        ]
    },
    "tay-du-ki-gen-z": {
        id: "tay-du-ki-gen-z",
        type: 'series',
        title: "TÂY DU KÍ GEN Z",
        description_1: `
            Series hoạt hình lấy cảm hứng từ nguyên tác Tây Du Ký kinh điển, nhưng trong một diện mạo hoàn toàn mới. Bằng việc lồng ghép yếu tố chuyển sinh (isekai), dự án đưa những nhân vật từ đa vũ trụ bước vào hành trình thỉnh kinh đầy biến số. Sự giao thoa giữa những thế giới khác biệt không chỉ mở ra những hướng đi không thể đoán trước, mà còn tạo nên một cuộc hành trình kịch tính, mãn nhãn và tràn đầy những cú twist bất ngờ.
        `,
        snippetsCount: 16,
        fanartCount: 9,
        firstAired: "2 THÁNG 9, 2021",
        youtubeId: 'sRKFWiY5Rys',
        sections: ['snippets', 'video', 'fanart', 'credits'],
        credits: [
            {role: 'DIRECTOR', names: 'VŨ SINO'},
            {role: 'CHARACTER DESIGN', names: 'VŨ SINO'},
            {role: 'SFX ARTIST', names: 'PEE PEE, VŨ SINO'},
            {role: 'ANIMATOR', names: 'VŨ SINO, VĂN PHÚ, ANHH KHANGG'},
            {role: 'VOICE CAST', names: 'KHANG., NGO, NHAN, DUC DUY, CHIP'},
            {role: 'COMPOSITING ARTISTS', names: 'OUTLASTZEDD, OVALKID'},
        ]
    },
    "khong-phai-la-ket-thuc": {
        id: "khong-phai-la-ket-thuc",
        type: 'mv',
        title: "KHÔNG PHẢI LÀ KẾT THÚC",
        description_1: `
            Dự án hợp tác giữa Sino Studio và Remind kể về hành trình vượt qua bóng tối để chạm tới ước mơ âm nhạc. Hình ảnh cô bé nhỏ luôn lặng lẽ theo sau Remind - nhưng dường như không được nhìn thấy. Chỉ khi chạm đến thành công, Remind ngoảnh lại và nhận ra: đó chính là mình của ngày xưa - phiên bản luôn âm thầm đồng hành, níu giữ và dẫn lối cô trên hành trình trưởng thành.
        `,
        firstAired: "14 THÁNG 3, 2026",
        characters: ['REMIND', 'YOUNG REMIND'],
        sections: ['snippets', 'characters', 'background', 'video', 'credits'],
        youtubeId: 'Y9z3uUep0NM',
        credits: [
            {role: 'DIRECTOR', names: 'VŨ SINO'},
            {role: 'EXECUTIVE PRODUCER', names: 'VŨ SINO'},
            {role: 'ANIMATORS', names: 'ANH KHANG, VĂN PHÚ, TRƯƠNG HUY, MINH TÚ, THANH VÂN, BANANA'},
            {role: 'CHARACTER DESIGN', names: 'BANANA'},
            {role: 'LAYOUT & BACKGROUND ARTISTS', names: 'MAC, TRẦN NGỌC ANH'},
            {role: 'COMPOSITING ARTIST', names: 'OUTLASTZEDD, 高橋'},
            {role: 'PRODUCTION MANAGER', names: 'HUYDS'},
        ]
    },
}