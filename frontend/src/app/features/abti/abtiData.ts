export type AbtiDimensionKey = "self" | "emotion" | "action" | "social" | "world";
export type AbtiPole = "left" | "right";
export type AbtiLocaleCode = "vi" | "nan";

export type AbtiOption = { key: string; text: string; score: number };
export type AbtiQuestion = { id: number; dim: AbtiDimensionKey; text: string; options: AbtiOption[] };
export type AbtiDimension = {
  title: string;
  left: { code: string; name: string; short: string };
  right: { code: string; name: string; short: string };
};

export type AbtiLocale = {
  code: AbtiLocaleCode;
  label: string;
  shortLabel: string;
  htmlLang: string;
  title: string;
  eyebrow: string;
  intro: string;
  startLabel: string;
  restartLabel: string;
  previousLabel: string;
  nextLabel: string;
  resultLabel: string;
  progressLabel: string;
  dimensionsLabel: string;
  adviceLabel: string;
  imageAltSuffix: string;
  disclaimer: string;
  emptyResultName: string;
  dimensions: Record<AbtiDimensionKey, AbtiDimension>;
  questions: AbtiQuestion[];
  archetypeNames: Record<string, string>;
  resultText: Record<AbtiDimensionKey, Record<AbtiPole, string>>;
  summary: Record<AbtiDimensionKey, Record<AbtiPole, string>>;
  advice: Record<AbtiDimensionKey, Record<AbtiPole, string>>;
};

export const abtiLocales: Record<AbtiLocaleCode, AbtiLocale> = {
  vi: {
    code: "vi",
    label: "Tiếng Việt",
    shortLabel: "VI",
    htmlLang: "vi",
    title: "ABTI Trắc nghiệm nhân cách hành vi trừu tượng",
    eyebrow: "Bài test vui cho người học ngôn ngữ",
    intro: "Chọn nhanh theo phản ứng đầu tiên. Sau 30 câu, hệ thống sẽ tạo mã ABTI, ảnh kết quả và vài dòng mô tả để bạn tự soi hoặc chia sẻ với bạn bè.",
    startLabel: "Bắt đầu",
    restartLabel: "Làm lại",
    previousLabel: "Quay lại",
    nextLabel: "Câu tiếp theo",
    resultLabel: "Xem kết quả",
    progressLabel: "Tiến độ",
    dimensionsLabel: "Năm chiều ABTI",
    adviceLabel: "Gợi ý nhỏ",
    imageAltSuffix: "ảnh kết quả",
    disclaimer: "ABTI là bài test giải trí, không phải chẩn đoán y khoa, tâm lý hay nghề nghiệp.",
    emptyResultName: "Mẫu nhân cách trừu tượng",
    dimensions: {
    "self": {
        "title": "Nhận thức bản thân",
        "left": {
            "code": "C",
            "name": "Kiểu tỉnh táo",
            "short": "Tự hiểu khá rõ"
        },
        "right": {
            "code": "M",
            "name": "Kiểu sương mù",
            "short": "Tự hiểu còn mờ"
        }
    },
    "emotion": {
        "title": "Mô thức cảm xúc",
        "left": {
            "code": "S",
            "name": "Kiểu ổn định",
            "short": "Cảm xúc khá bền"
        },
        "right": {
            "code": "W",
            "name": "Kiểu dao động",
            "short": "Cảm xúc nhiều sóng"
        }
    },
    "action": {
        "title": "Động lực hành động",
        "left": {
            "code": "P",
            "name": "Kiểu đẩy việc",
            "short": "Làm trước tính sau"
        },
        "right": {
            "code": "D",
            "name": "Kiểu cần đệm",
            "short": "Cần khởi động tinh thần"
        }
    },
    "social": {
        "title": "Trạng thái xã giao",
        "left": {
            "code": "O",
            "name": "Kiểu mở",
            "short": "Dễ bật chế độ nói"
        },
        "right": {
            "code": "H",
            "name": "Kiểu lặn",
            "short": "Tiết kiệm pin xã giao"
        }
    },
    "world": {
        "title": "Thái độ với thế giới",
        "left": {
            "code": "B",
            "name": "Kiểu xây dựng",
            "short": "Muốn sửa lại đời"
        },
        "right": {
            "code": "K",
            "name": "Kiểu giải cấu trúc",
            "short": "Nhìn đời hơi phi lý"
        }
    }
},
    questions: [
    {
        "id": 1,
        "dim": "self",
        "text": "Lướt thấy một bài kiểu “tôi tệ quá, ai cũng sống tốt hơn tôi”, phản ứng đầu tiên của bạn là?",
        "options": [
            {
                "key": "A",
                "text": "Thôi đừng đọc nữa, chính là tôi đó",
                "score": -2
            },
            {
                "key": "B",
                "text": "Tôi đứng ngoài hóng drama, nhưng hơi không hiểu",
                "score": 0
            },
            {
                "key": "C",
                "text": "Thoát khỏi kênh cảm xúc, chuyện này không liên quan tôi lắm",
                "score": 2
            }
        ]
    },
    {
        "id": 2,
        "dim": "self",
        "text": "Thấy người xung quanh ngày càng giỏi, còn mình như đứng yên tại chỗ, bạn sẽ?",
        "options": [
            {
                "key": "A",
                "text": "Vỡ nhẹ, cảm giác mình là mẫu vật thất bại",
                "score": -2
            },
            {
                "key": "B",
                "text": "Emo một lúc, nhưng vẫn nhặt mình lại được",
                "score": 0
            },
            {
                "key": "C",
                "text": "Họ giỏi phần họ, tôi vẫn là tôi",
                "score": 2
            }
        ]
    },
    {
        "id": 3,
        "dim": "self",
        "text": "Nếu ai đó hỏi “rốt cuộc bạn là kiểu người như thế nào?”, bạn sẽ?",
        "options": [
            {
                "key": "A",
                "text": "Bản thân tôi còn đang loading",
                "score": -2
            },
            {
                "key": "B",
                "text": "Đại khái biết, nhưng hệ thống ngôn ngữ sập rồi",
                "score": 0
            },
            {
                "key": "C",
                "text": "Tôi biết mình thuộc giống loài nào",
                "score": 2
            }
        ]
    },
    {
        "id": 4,
        "dim": "self",
        "text": "Trong lòng bạn có một thứ thật sự muốn chạy về phía nó không?",
        "options": [
            {
                "key": "A",
                "text": "Không rõ, đời như đang phát ngẫu nhiên",
                "score": -2
            },
            {
                "key": "B",
                "text": "Có một chút, nhưng tín hiệu chập chờn",
                "score": 0
            },
            {
                "key": "C",
                "text": "Có, và tôi biết nó ở đâu",
                "score": 2
            }
        ]
    },
    {
        "id": 5,
        "dim": "self",
        "text": "Khi nhìn thấy một người rất giỏi, bạn dễ nghĩ gì hơn?",
        "options": [
            {
                "key": "A",
                "text": "Thôi, chắc tôi nên hủy đăng ký cuộc đời",
                "score": -2
            },
            {
                "key": "B",
                "text": "Hơi chua, nhưng cũng hơi muốn nhúc nhích",
                "score": 0
            },
            {
                "key": "C",
                "text": "Tôi cũng phải nâng cấp, bắt đầu tiến hóa ngay",
                "score": 2
            }
        ]
    },
    {
        "id": 6,
        "dim": "self",
        "text": "Một câu nhận xét tiêu cực ném vào bạn, bạn sẽ?",
        "options": [
            {
                "key": "A",
                "text": "Rồi, tối nay phát lại trong đầu theo vòng lặp",
                "score": -2
            },
            {
                "key": "B",
                "text": "Sẽ khó chịu một lúc, nhưng không tắt máy hẳn",
                "score": 0
            },
            {
                "key": "C",
                "text": "Nghe thấy rồi, nhưng không định cho nó thuê phòng trong đầu",
                "score": 2
            }
        ]
    },
    {
        "id": 7,
        "dim": "emotion",
        "text": "Người bạn thích lâu không trả lời, rồi nói “nãy bận quá”. Phản ứng đầu tiên của bạn là?",
        "options": [
            {
                "key": "A",
                "text": "Bận á? Tôi thấy có mùi cốt truyện",
                "score": -2
            },
            {
                "key": "B",
                "text": "Tôi muốn tin, nhưng não tôi không cho",
                "score": 0
            },
            {
                "key": "C",
                "text": "Ok, bận xong trả lời là được",
                "score": 2
            }
        ]
    },
    {
        "id": 8,
        "dim": "emotion",
        "text": "Đối phương đột nhiên lạnh nhạt hơn một chút, bạn sẽ?",
        "options": [
            {
                "key": "A",
                "text": "Xong rồi, mối quan hệ này sắp phá sản à?",
                "score": -2
            },
            {
                "key": "B",
                "text": "Hơi hoảng, nhưng quan sát thêm đã",
                "score": 0
            },
            {
                "key": "C",
                "text": "Chưa đến mức đó, chắc chỉ là vấn đề trạng thái",
                "score": 2
            }
        ]
    },
    {
        "id": 9,
        "dim": "emotion",
        "text": "Nếu bạn thật sự thích một người, bạn sẽ?",
        "options": [
            {
                "key": "A",
                "text": "Thích thì thích, nhưng tôi đứng xa quan sát trước",
                "score": 2
            },
            {
                "key": "B",
                "text": "Sẽ nghiêm túc hơn, nhưng tự kéo dây cảnh báo cho mình",
                "score": 0
            },
            {
                "key": "C",
                "text": "Rất để tâm, cực kỳ để tâm, thậm chí hơi lú tình",
                "score": -2
            }
        ]
    },
    {
        "id": 10,
        "dim": "emotion",
        "text": "Nếu gặp một người cực kỳ đúng gu lý tưởng của bạn, bạn giống kiểu nào hơn?",
        "options": [
            {
                "key": "A",
                "text": "Tuyệt quá, nhưng tôi giả chết quan sát trước",
                "score": 2
            },
            {
                "key": "B",
                "text": "Rung động, nhưng lý trí vẫn đang trực ca",
                "score": 0
            },
            {
                "key": "C",
                "text": "Thôi xong, não yêu đương của tôi bật nguồn rồi",
                "score": -2
            }
        ]
    },
    {
        "id": 11,
        "dim": "emotion",
        "text": "Trong một mối quan hệ, nếu đối phương rất dính bạn, ngày nào cũng muốn tìm bạn, bạn sẽ?",
        "options": [
            {
                "key": "A",
                "text": "Hay quá, cảm giác được cần đến thơm thật",
                "score": -2
            },
            {
                "key": "B",
                "text": "Tùy pin ngày hôm đó của tôi",
                "score": 0
            },
            {
                "key": "C",
                "text": "Cứu, tôi cần không khí riêng",
                "score": 2
            }
        ]
    },
    {
        "id": 12,
        "dim": "emotion",
        "text": "Dù quan hệ thân đến đâu, bạn có vẫn cần không gian riêng không?",
        "options": [
            {
                "key": "A",
                "text": "Không cần lắm, tôi thích chế độ dính nhau",
                "score": -2
            },
            {
                "key": "B",
                "text": "Tùy người, tùy giai đoạn, tùy pin của tôi",
                "score": 0
            },
            {
                "key": "C",
                "text": "Rất cần, đừng cưỡng ép nhấp đúp vào tôi",
                "score": 2
            }
        ]
    },
    {
        "id": 13,
        "dim": "world",
        "text": "Một người lạ đột nhiên tốt với bạn, phản ứng đầu tiên của bạn là?",
        "options": [
            {
                "key": "A",
                "text": "Khoan, người này có nhiệm vụ ẩn gì không?",
                "score": -2
            },
            {
                "key": "B",
                "text": "Quan sát trước, đừng vội cảm động",
                "score": 0
            },
            {
                "key": "C",
                "text": "Ồ, thế giới vẫn còn dễ thương chút đó",
                "score": 2
            }
        ]
    },
    {
        "id": 14,
        "dim": "world",
        "text": "Bạn nghĩ sao về câu “đa số mọi người thật ra đều tốt bụng”?",
        "options": [
            {
                "key": "A",
                "text": "Đừng ngây thơ quá, loài người phức tạp lắm",
                "score": -2
            },
            {
                "key": "B",
                "text": "Có thể, tôi không dám chốt một câu",
                "score": 0
            },
            {
                "key": "C",
                "text": "Tôi sẵn lòng tin vào thiện ý trước",
                "score": 2
            }
        ]
    },
    {
        "id": 15,
        "dim": "world",
        "text": "Bạn đã có kế hoạch, nhưng đột nhiên xuất hiện một việc bạn muốn làm hơn, bạn sẽ?",
        "options": [
            {
                "key": "A",
                "text": "Kế hoạch là gì, ăn được không?",
                "score": -2
            },
            {
                "key": "B",
                "text": "Xem hậu quả, lách được thì lách",
                "score": 0
            },
            {
                "key": "C",
                "text": "Vẫn theo kế hoạch, đừng bày trò nữa",
                "score": 2
            }
        ]
    },
    {
        "id": 16,
        "dim": "world",
        "text": "Người khác nói “ai cũng làm vậy, bạn cũng nên làm vậy”, bạn sẽ?",
        "options": [
            {
                "key": "A",
                "text": "Ai là ‘ai’? Tôi xin rút khỏi ‘mọi người’",
                "score": -2
            },
            {
                "key": "B",
                "text": "Nghe thử đã, có lý thì tính",
                "score": 0
            },
            {
                "key": "C",
                "text": "Nếu quy tắc hợp lý, tôi có thể phối hợp",
                "score": 2
            }
        ]
    },
    {
        "id": 17,
        "dim": "world",
        "text": "Khi làm một việc dài hạn, bạn có cần biết “vì sao phải làm” không?",
        "options": [
            {
                "key": "A",
                "text": "Không biết vẫn có thể bị đời đẩy đi",
                "score": -2
            },
            {
                "key": "B",
                "text": "Có lý do thì tốt hơn, không có cũng gồng được",
                "score": 0
            },
            {
                "key": "C",
                "text": "Bắt buộc phải biết, không thì linh hồn tôi không đi làm",
                "score": 2
            }
        ]
    },
    {
        "id": 18,
        "dim": "world",
        "text": "Bạn có bao giờ đột nhiên thấy “mọi người cố gắng qua lại thật ra cũng khá phi lý” không?",
        "options": [
            {
                "key": "A",
                "text": "Thường xuyên, đời như một dự án tạm bợ khổng lồ",
                "score": -2
            },
            {
                "key": "B",
                "text": "Thỉnh thoảng, nhưng tôi không ở đó lâu",
                "score": 0
            },
            {
                "key": "C",
                "text": "Hiếm lắm, tôi vẫn tin nỗ lực có ý nghĩa",
                "score": 2
            }
        ]
    },
    {
        "id": 19,
        "dim": "action",
        "text": "Gặp một cơ hội có thử thách nhưng có thể giúp bạn trưởng thành, bạn sẽ?",
        "options": [
            {
                "key": "A",
                "text": "Sợ trước đã, trailer thất bại đã chiếu rồi",
                "score": -2
            },
            {
                "key": "B",
                "text": "Do dự một chút, nhưng có thể sẽ thử",
                "score": 0
            },
            {
                "key": "C",
                "text": "Nhận, nâng cấp trước rồi tính",
                "score": 2
            }
        ]
    },
    {
        "id": 20,
        "dim": "action",
        "text": "Gặp một vấn đề rất phiền nhưng bắt buộc phải giải quyết, bạn sẽ?",
        "options": [
            {
                "key": "A",
                "text": "Để đó trước, xem nó có tự biến mất không",
                "score": -2
            },
            {
                "key": "B",
                "text": "Vừa chửi vừa xử lý",
                "score": 0
            },
            {
                "key": "C",
                "text": "Tìm cách thẳng tay xử nó",
                "score": 2
            }
        ]
    },
    {
        "id": 21,
        "dim": "action",
        "text": "Khi chọn trà sữa, quán ăn, món đồ cần mua, bạn thường?",
        "options": [
            {
                "key": "A",
                "text": "Bệnh khó chọn phát tác ngay tại chỗ",
                "score": -2
            },
            {
                "key": "B",
                "text": "Do dự một chút, cuối cùng phó mặc duyên số",
                "score": 0
            },
            {
                "key": "C",
                "text": "Chọn luôn, đừng làm chậm tiến độ đời tôi",
                "score": 2
            }
        ]
    },
    {
        "id": 22,
        "dim": "action",
        "text": "Nếu bây giờ phải chọn mù A/B/C, không có bất kỳ gợi ý nào, bạn sẽ?",
        "options": [
            {
                "key": "A",
                "text": "Tôi cố tìm quy luật trong không khí",
                "score": -2
            },
            {
                "key": "B",
                "text": "Chọn thì chọn được, nhưng trong lòng không chắc",
                "score": 0
            },
            {
                "key": "C",
                "text": "Chọn luôn, sai rồi sống tiếp",
                "score": 2
            }
        ]
    },
    {
        "id": 23,
        "dim": "action",
        "text": "Người khác nói bạn có năng lực hành động mạnh, trong lòng bạn nghĩ?",
        "options": [
            {
                "key": "A",
                "text": "Mạnh cái gì, deadline đang kề dao vào cổ tôi",
                "score": -2
            },
            {
                "key": "B",
                "text": "Đôi lúc đúng là vẫn nhúc nhích được",
                "score": 0
            },
            {
                "key": "C",
                "text": "Đúng, tôi là giống loài chuyên đẩy việc",
                "score": 2
            }
        ]
    },
    {
        "id": 24,
        "dim": "action",
        "text": "Sau khi lập kế hoạch, tình huống thường gặp nhất của bạn là?",
        "options": [
            {
                "key": "A",
                "text": "Kế hoạch rất đẹp, thực tế không xứng",
                "score": -2
            },
            {
                "key": "B",
                "text": "Có cái làm xong, có cái biến thành di tích",
                "score": 0
            },
            {
                "key": "C",
                "text": "Tôi sẽ cố theo kế hoạch, đừng phá nhịp của tôi",
                "score": 2
            }
        ]
    },
    {
        "id": 25,
        "dim": "social",
        "text": "Một người nói chuyện online khá hợp hẹn bạn gặp ngoài đời, bạn sẽ?",
        "options": [
            {
                "key": "A",
                "text": "Tôi hồi hộp trước đã, linh hồn trốn vào chăn",
                "score": -2
            },
            {
                "key": "B",
                "text": "Xem người đó là ai, xem bối cảnh, xem có an toàn không",
                "score": 0
            },
            {
                "key": "C",
                "text": "Được chứ, mở phó bản xã giao thôi",
                "score": 2
            }
        ]
    },
    {
        "id": 26,
        "dim": "social",
        "text": "Bạn bè dẫn theo một người bạn không quen cùng đi chơi, bạn thường?",
        "options": [
            {
                "key": "A",
                "text": "Bật im lặng quan sát trước, đây là giống loài nào",
                "score": -2
            },
            {
                "key": "B",
                "text": "Xem người đó có dễ bắt chuyện không",
                "score": 0
            },
            {
                "key": "C",
                "text": "Chủ động nói chuyện, không để không khí bị lạnh",
                "score": 2
            }
        ]
    },
    {
        "id": 27,
        "dim": "social",
        "text": "Người khác tiến lại quá nhanh, hỏi nhiều chuyện riêng tư, bạn sẽ?",
        "options": [
            {
                "key": "A",
                "text": "Báo động vang rồi, xin giữ khoảng cách an toàn",
                "score": -2
            },
            {
                "key": "B",
                "text": "Hơi khó chịu, nhưng còn xem quan hệ",
                "score": 0
            },
            {
                "key": "C",
                "text": "Cũng ổn, tôi không phòng bị đến vậy",
                "score": 2
            }
        ]
    },
    {
        "id": 28,
        "dim": "social",
        "text": "Gặp người thật sự tin được, bạn có muốn mối quan hệ trở nên rất thân không?",
        "options": [
            {
                "key": "A",
                "text": "Muốn, tôi cần đồng đội linh hồn",
                "score": 2
            },
            {
                "key": "B",
                "text": "Muốn gần hơn, nhưng cũng sợ quá gần",
                "score": 0
            },
            {
                "key": "C",
                "text": "Chưa chắc, tôi quen giữ lại một khoảng cách",
                "score": -2
            }
        ]
    },
    {
        "id": 29,
        "dim": "social",
        "text": "Bạn có ý kiến tiêu cực nhưng không nói ra, thường là vì?",
        "options": [
            {
                "key": "A",
                "text": "Tôi thường nói thẳng, nhịn khó chịu lắm",
                "score": 2
            },
            {
                "key": "B",
                "text": "Sợ bầu không khí nứt ra, nhịn trước đã",
                "score": 0
            },
            {
                "key": "C",
                "text": "Không muốn lộ góc tối bé xíu của mình",
                "score": -2
            }
        ]
    },
    {
        "id": 30,
        "dim": "social",
        "text": "Trước những nhóm người khác nhau, bạn có đổi phiên bản của mình không?",
        "options": [
            {
                "key": "A",
                "text": "Không nhiều, tôi gần như xuất xưởng nguyên bản",
                "score": 2
            },
            {
                "key": "B",
                "text": "Có tinh chỉnh một chút cho hợp hoàn cảnh",
                "score": 0
            },
            {
                "key": "C",
                "text": "Có, và giống như mở nhiều tài khoản khác nhau",
                "score": -2
            }
        ]
    }
],
    archetypeNames: {
    "CSPOB": "CTRL-R｜Kẻ tái thiết",
    "CSPOK": "TRANS｜Kẻ phiên dịch lời điên",
    "CSPHB": "MUTE-FIX｜Thợ sửa im lặng",
    "CSPHK": "NASA-0｜Người quan sát lạnh mặt",
    "CSDOB": "PLAN-B｜Tấm đệm dự phòng",
    "CSDOK": "LAZY-LAW｜Thẩm phán nằm im",
    "CSDHB": "PATCH｜Người khâu vá",
    "CSDHK": "NARR-OS｜Máy chạy lời dẫn",
    "CWPOB": "ELEC-FIX｜Thợ sửa nhiễm điện",
    "CWPOK": "BOOM｜Não pháo hoa",
    "CWPHB": "CRY-WORK｜Người vừa khóc vừa làm",
    "CWPHK": "RADAR-SUB｜Tàu ngầm cảm xúc",
    "CWDOB": "SOP-ANX｜Quy trình lo âu",
    "CWDOK": "PING-PONG｜Máy nhảy qua lại",
    "CWDHB": "SOFT-BUG｜Lỗi mềm dịu dàng",
    "CWDHK": "NIGHT-CRT｜Quan tòa nửa đêm",
    "MSPOB": "LUCKY-HERO｜Vị cứu tinh tình cờ",
    "MSPOK": "CUT-UP｜Kẻ giải cấu trúc",
    "MSPHB": "SLOW-OK｜Người giao bài chậm mà chắc",
    "MSPHK": "DEEP-SEA｜Nhà khảo cổ lặn sâu",
    "MSDOB": "TIDY-0｜Người dọn phế tích",
    "MSDOK": "SOFA-SAGE｜Triết gia nằm sofa",
    "MSDHB": "SAFE-BOX｜Đội trưởng vùng an toàn",
    "MSDHK": "LOW-BAT｜Người pin yếu",
    "MWPOB": "CHAOS-SUN｜Vật thể phát sáng hỗn loạn",
    "MWPOK": "STORM-X｜Máy tạo bão",
    "MWPHB": "BACKUP-BOT｜Robot bù chỗ",
    "MWPHK": "MOON-RUIN｜Người ngắm trăng trong phế tích",
    "MWDOB": "JELLY-FIX｜Sứa vá lỗi",
    "MWDOK": "DANMU-X｜Máy phụ đề tinh thần",
    "MWDHB": "SAVE-ME｜Thực tập sinh tự cứu",
    "MWDHK": "UNI-EMO｜Nhà thơ nội hao"
},
    resultText: {
    "self": {
        "left": "Bạn không phải không điên; bạn điên nhưng có mục lục. Khi người khác còn gào “sao lại thế này”, bạn đã bắt đầu đánh số, lưu kho và chú thích cú sụp của mình.",
        "right": "Nhận thức bản thân của bạn giống biển hiệu cửa hàng tiện lợi lúc 3 giờ sáng: vẫn sáng, nhưng nhấp nháy. Bạn biết mình có chuyện, chỉ là khó dịch nó sang tiếng người."
    },
    "emotion": {
        "left": "Hệ thống cảm xúc của bạn giống nồi cơm điện cũ nhưng bền: thỉnh thoảng bốc khói, nhưng cơm vẫn chín. Bạn sẽ buồn, nhưng không nhất thiết tắt máy ngay.",
        "right": "Cảm xúc của bạn giống máy đo địa chấn siêu nhạy: người khác chỉ dậm chân nhẹ, bên bạn đã hiện chuyển động mảng kiến tạo. Không phải làm quá, chỉ là bộ thu tín hiệu quá chăm."
    },
    "action": {
        "left": "Bạn thuộc kiểu đẩy xe ra đường trước rồi mới nghiên cứu phanh. Kế hoạch có thể chưa mọc đủ chân, nhưng bạn đã khiến sự việc bắt đầu lăn trong đời thật.",
        "right": "Hệ thống hành động của bạn cần nghi thức, khởi động tâm lý và một chút giấy phép từ vũ trụ. Bạn không phế, chỉ là khởi động giống máy tính cũ."
    },
    "social": {
        "left": "Bạn không phải lúc nào cũng hướng ngoại; chỉ là gặp đúng tần số thì đột nhiên biến thành trạm phát sóng. Bình thường ham muốn biểu đạt ngủ, tỉnh dậy thì rất ồn.",
        "right": "Pin xã giao của bạn không thấp, mà là rất đắt. Xã giao vô nghĩa như phần mềm chạy lén nền, có thể ăn sạch pin của cả con người bạn."
    },
    "world": {
        "left": "Thấy hỗn loạn, bạn không nhịn được muốn dán nhãn, vá lỗi và dựng khung chống cho thế giới. Bạn có thể cũng muốn hét, nhưng sẽ vừa hét vừa sửa.",
        "right": "Bạn nhìn thế giới như một vở kịch chưa tập: phi lý, nghiêm túc, quá đáng, nhưng ai cũng giả vờ quy trình rất hợp lý. Việc của bạn là nhìn thấu và chạy phụ đề trong lòng."
    }
},
    summary: {
      self: { left: "bạn có thể đặt tên cho điểm lỗi của mình", right: "bạn vẫn đang giải mã chính mình" },
      emotion: { left: "nền cảm xúc khá bền", right: "radar cảm xúc rất nhạy" },
      action: { left: "bạn kéo việc ra đời thật khá nhanh", right: "bạn cần một đoạn khởi động tinh thần" },
      social: { left: "gặp đúng kênh là bạn bật sáng", right: "pin xã giao của bạn cần được bảo vệ" },
      world: { left: "thấy hỗn loạn là muốn sửa", right: "thấy đời là tự sinh phụ đề phi lý" }
    },
    advice: {
      self: { left: "Giữ khả năng tự quan sát, nhưng đừng biến mọi cảm xúc thành bảng kiểm lỗi.", right: "Khi không gọi tên được mình, hãy ghi lại một việc nhỏ bạn thật sự muốn làm hôm nay." },
      emotion: { left: "Ổn định cũng cần bảo trì. Đừng chỉ vì chịu được mà bỏ qua cảm xúc của mình.", right: "Khi não mở phiên tòa, hãy hoãn phán quyết lớn cho tới khi bạn ngủ đủ." },
      action: { left: "Bạn giỏi đẩy việc, nhưng không phải mọi đống hỗn độn đều cần bạn sửa.", right: "Đừng ép mình lập tức hoàn hảo. Mở tệp, viết tiêu đề rồi lưu lại cũng đã là bắt đầu." },
      social: { left: "Bạn có thể thắp sáng bầu không khí, nhưng cũng cần giờ đóng cửa cho chính mình.", right: "Năng lượng xã giao là tài nguyên hiếm; bớt giải thích một chút cũng không sao." },
      world: { left: "Xây dựng giúp sống tiếp, nhưng đừng vay nợ xây nhà trên phế tích của người khác.", right: "Giải cấu trúc rất đã, thỉnh thoảng cũng nên đưa cho hiện thực một cái tua-vít." }
    }
  },
  nan: {
    code: "nan",
    label: "闽南语",
    shortLabel: "MN",
    htmlLang: "zh-Hant",
    title: "ABTI 抽象行为人格测试",
    eyebrow: "Hoan-hi chit-e lang-kak test",
    intro: "每题照第一反应选。三十题之后，系统会生成你的 ABTI 代码、结果图和一段适合分享的说明。",
    startLabel: "开始测试",
    restartLabel: "重新测试",
    previousLabel: "上一题",
    nextLabel: "下一题",
    resultLabel: "看结果",
    progressLabel: "进度",
    dimensionsLabel: "ABTI 五个维度",
    adviceLabel: "小建议",
    imageAltSuffix: "结果图",
    disclaimer: "ABTI 是娱乐型人格测试，不构成医学、心理或职业诊断。",
    emptyResultName: "抽象人格样本",
    dimensions: {
    "self": {
        "title": "自我感知",
        "left": {
            "code": "C",
            "name": "清醒型",
            "short": "自我清晰"
        },
        "right": {
            "code": "M",
            "name": "迷雾型",
            "short": "自我迷雾"
        }
    },
    "emotion": {
        "title": "情绪模式",
        "left": {
            "code": "S",
            "name": "稳态型",
            "short": "情绪稳态"
        },
        "right": {
            "code": "W",
            "name": "波动型",
            "short": "情绪波动"
        }
    },
    "action": {
        "title": "行动驱力",
        "left": {
            "code": "P",
            "name": "推进型",
            "short": "立即推进"
        },
        "right": {
            "code": "D",
            "name": "缓冲型",
            "short": "先缓一缓"
        }
    },
    "social": {
        "title": "社交状态",
        "left": {
            "code": "O",
            "name": "开放型",
            "short": "开放表达"
        },
        "right": {
            "code": "H",
            "name": "潜水型",
            "short": "低耗潜水"
        }
    },
    "world": {
        "title": "世界态度",
        "left": {
            "code": "B",
            "name": "建设型",
            "short": "现实建设"
        },
        "right": {
            "code": "K",
            "name": "解构型",
            "short": "抽象解构"
        }
    }
},
    questions: [
    {
        "id": 1,
        "dim": "self",
        "text": "刷到一段“我真的好差、别人都过得比我好”的崩溃小作文，你第一反应是？",
        "options": [
            {
                "key": "A",
                "text": "别念了，这不就是我本人",
                "score": -2
            },
            {
                "key": "B",
                "text": "我在旁边看热闹，但有点不懂",
                "score": 0
            },
            {
                "key": "C",
                "text": "退出情绪频道，这和我关系不大",
                "score": 2
            }
        ]
    },
    {
        "id": 2,
        "dim": "self",
        "text": "看到身边人越来越厉害，而自己好像原地踏步，你会？",
        "options": [
            {
                "key": "A",
                "text": "破防了，感觉自己像废物样本",
                "score": -2
            },
            {
                "key": "B",
                "text": "emo 一下，但还能捡回来",
                "score": 0
            },
            {
                "key": "C",
                "text": "他们强他们的，我还是我",
                "score": 2
            }
        ]
    },
    {
        "id": 3,
        "dim": "self",
        "text": "别人问你“你到底是个什么样的人”，你会？",
        "options": [
            {
                "key": "A",
                "text": "我本人还没加载完成",
                "score": -2
            },
            {
                "key": "B",
                "text": "大概知道，但语言系统崩了",
                "score": 0
            },
            {
                "key": "C",
                "text": "我知道自己是什么品种",
                "score": 2
            }
        ]
    },
    {
        "id": 4,
        "dim": "self",
        "text": "你心里有没有一个真正想奔向的东西？",
        "options": [
            {
                "key": "A",
                "text": "没有，人生像随机播放",
                "score": -2
            },
            {
                "key": "B",
                "text": "有一点，但信号不稳定",
                "score": 0
            },
            {
                "key": "C",
                "text": "有，而且我知道它在哪里",
                "score": 2
            }
        ]
    },
    {
        "id": 5,
        "dim": "self",
        "text": "看到很强的人，你更容易想？",
        "options": [
            {
                "key": "A",
                "text": "算了，我还是退订人生吧",
                "score": -2
            },
            {
                "key": "B",
                "text": "有点酸，也有点想动",
                "score": 0
            },
            {
                "key": "C",
                "text": "我也要升级，立刻开始进化",
                "score": 2
            }
        ]
    },
    {
        "id": 6,
        "dim": "self",
        "text": "别人一句负面评价砸过来，你会？",
        "options": [
            {
                "key": "A",
                "text": "好，今晚脑内循环播放",
                "score": -2
            },
            {
                "key": "B",
                "text": "会难受一阵，但不会彻底死机",
                "score": 0
            },
            {
                "key": "C",
                "text": "听到了，但不准备收留它",
                "score": 2
            }
        ]
    },
    {
        "id": 7,
        "dim": "emotion",
        "text": "喜欢的人很久没回消息，说“刚刚太忙了”。你第一反应是？",
        "options": [
            {
                "key": "A",
                "text": "忙？我看是有剧情",
                "score": -2
            },
            {
                "key": "B",
                "text": "我想信，但我的脑子不让",
                "score": 0
            },
            {
                "key": "C",
                "text": "行，忙完回就好",
                "score": 2
            }
        ]
    },
    {
        "id": 8,
        "dim": "emotion",
        "text": "对方突然冷淡一点，你会？",
        "options": [
            {
                "key": "A",
                "text": "完了，关系是不是要倒闭了",
                "score": -2
            },
            {
                "key": "B",
                "text": "有点慌，但先观察",
                "score": 0
            },
            {
                "key": "C",
                "text": "不至于，可能只是状态问题",
                "score": 2
            }
        ]
    },
    {
        "id": 9,
        "dim": "emotion",
        "text": "如果你真的喜欢一个人，你会？",
        "options": [
            {
                "key": "A",
                "text": "喜欢归喜欢，我先站远点",
                "score": 2
            },
            {
                "key": "B",
                "text": "会投入，但给自己拉警戒线",
                "score": 0
            },
            {
                "key": "C",
                "text": "上心，非常上心，甚至有点上头",
                "score": -2
            }
        ]
    },
    {
        "id": 10,
        "dim": "emotion",
        "text": "如果遇到一个特别符合你理想型的人，你更像？",
        "options": [
            {
                "key": "A",
                "text": "太好了，但我先装死观察",
                "score": 2
            },
            {
                "key": "B",
                "text": "心动，但理智还在值班",
                "score": 0
            },
            {
                "key": "C",
                "text": "完了，我的恋爱脑要开机了",
                "score": -2
            }
        ]
    },
    {
        "id": 11,
        "dim": "emotion",
        "text": "关系里对方很黏你，每天都想找你，你会？",
        "options": [
            {
                "key": "A",
                "text": "好耶，被需要的感觉真香",
                "score": -2
            },
            {
                "key": "B",
                "text": "看我当天电量",
                "score": 0
            },
            {
                "key": "C",
                "text": "救命，我需要私人空气",
                "score": 2
            }
        ]
    },
    {
        "id": 12,
        "dim": "emotion",
        "text": "关系再亲密，你是否也需要自己的空间？",
        "options": [
            {
                "key": "A",
                "text": "不太需要，我喜欢贴贴模式",
                "score": -2
            },
            {
                "key": "B",
                "text": "看人，看阶段，看我电量",
                "score": 0
            },
            {
                "key": "C",
                "text": "非常需要，别强行双击我",
                "score": 2
            }
        ]
    },
    {
        "id": 13,
        "dim": "world",
        "text": "陌生人突然对你很好，你第一反应是？",
        "options": [
            {
                "key": "A",
                "text": "等等，他是不是有隐藏任务",
                "score": -2
            },
            {
                "key": "B",
                "text": "先观望，别急着感动",
                "score": 0
            },
            {
                "key": "C",
                "text": "哇，世界还有点可爱",
                "score": 2
            }
        ]
    },
    {
        "id": 14,
        "dim": "world",
        "text": "你怎么看“大多数人其实是善良的”？",
        "options": [
            {
                "key": "A",
                "text": "别太天真，人类很复杂",
                "score": -2
            },
            {
                "key": "B",
                "text": "可能吧，我不敢一口咬死",
                "score": 0
            },
            {
                "key": "C",
                "text": "我愿意先相信善意",
                "score": 2
            }
        ]
    },
    {
        "id": 15,
        "dim": "world",
        "text": "本来有安排，但突然出现一个你更想做的事，你会？",
        "options": [
            {
                "key": "A",
                "text": "计划是什么，可以吃吗",
                "score": -2
            },
            {
                "key": "B",
                "text": "看后果，能钻就钻",
                "score": 0
            },
            {
                "key": "C",
                "text": "还是按计划来，别整活",
                "score": 2
            }
        ]
    },
    {
        "id": 16,
        "dim": "world",
        "text": "别人说“大家都这样，你也应该这样”，你会？",
        "options": [
            {
                "key": "A",
                "text": "谁是大家？我退出大家",
                "score": -2
            },
            {
                "key": "B",
                "text": "先听听，有道理再说",
                "score": 0
            },
            {
                "key": "C",
                "text": "如果规则合理，我可以配合",
                "score": 2
            }
        ]
    },
    {
        "id": 17,
        "dim": "world",
        "text": "做一件长期的事时，你需要知道“为什么要做”吗？",
        "options": [
            {
                "key": "A",
                "text": "不知道也能被生活推着走",
                "score": -2
            },
            {
                "key": "B",
                "text": "有理由更好，没有也能硬做",
                "score": 0
            },
            {
                "key": "C",
                "text": "必须知道，不然我灵魂不上班",
                "score": 2
            }
        ]
    },
    {
        "id": 18,
        "dim": "world",
        "text": "你会不会突然觉得“大家努力来努力去也挺荒诞”？",
        "options": [
            {
                "key": "A",
                "text": "经常，人生像大型临时项目",
                "score": -2
            },
            {
                "key": "B",
                "text": "偶尔会，但不常住在那里",
                "score": 0
            },
            {
                "key": "C",
                "text": "很少，我更相信努力有意义",
                "score": 2
            }
        ]
    },
    {
        "id": 19,
        "dim": "action",
        "text": "遇到一个有挑战但可能让你成长的机会，你会？",
        "options": [
            {
                "key": "A",
                "text": "先害怕，失败预告片已经开播",
                "score": -2
            },
            {
                "key": "B",
                "text": "犹豫一下，但可能会试",
                "score": 0
            },
            {
                "key": "C",
                "text": "接，先升级再说",
                "score": 2
            }
        ]
    },
    {
        "id": 20,
        "dim": "action",
        "text": "遇到一个必须解决但很烦的问题，你会？",
        "options": [
            {
                "key": "A",
                "text": "先放着，看它会不会自己消失",
                "score": -2
            },
            {
                "key": "B",
                "text": "一边骂一边处理",
                "score": 0
            },
            {
                "key": "C",
                "text": "直接找办法，把它端了",
                "score": 2
            }
        ]
    },
    {
        "id": 21,
        "dim": "action",
        "text": "点奶茶、选餐厅、买东西时，你通常？",
        "options": [
            {
                "key": "A",
                "text": "选择困难症当场发作",
                "score": -2
            },
            {
                "key": "B",
                "text": "犹豫一下，最后随缘",
                "score": 0
            },
            {
                "key": "C",
                "text": "直接选，别耽误我人生进度",
                "score": 2
            }
        ]
    },
    {
        "id": 22,
        "dim": "action",
        "text": "如果现在必须盲选 A/B/C，没有任何提示，你会？",
        "options": [
            {
                "key": "A",
                "text": "我试图从空气里找规律",
                "score": -2
            },
            {
                "key": "B",
                "text": "选是能选，但心里没底",
                "score": 0
            },
            {
                "key": "C",
                "text": "直接选，错了再活",
                "score": 2
            }
        ]
    },
    {
        "id": 23,
        "dim": "action",
        "text": "别人说你执行力强，你心里想？",
        "options": [
            {
                "key": "A",
                "text": "强个鬼，是 deadline 拿刀架着我",
                "score": -2
            },
            {
                "key": "B",
                "text": "有时候确实还能动",
                "score": 0
            },
            {
                "key": "C",
                "text": "对，我就是推进型人类",
                "score": 2
            }
        ]
    },
    {
        "id": 24,
        "dim": "action",
        "text": "你做计划之后，最常见的情况是？",
        "options": [
            {
                "key": "A",
                "text": "计划很美，现实不配合",
                "score": -2
            },
            {
                "key": "B",
                "text": "有些能做完，有些变成遗址",
                "score": 0
            },
            {
                "key": "C",
                "text": "我会尽量按计划走，别乱我节奏",
                "score": 2
            }
        ]
    },
    {
        "id": 25,
        "dim": "social",
        "text": "网上聊得不错的人约你线下见面，你会？",
        "options": [
            {
                "key": "A",
                "text": "我先紧张一下，灵魂躲进被窝",
                "score": -2
            },
            {
                "key": "B",
                "text": "看人、看场合、看安全感",
                "score": 0
            },
            {
                "key": "C",
                "text": "可以啊，社交副本开启",
                "score": 2
            }
        ]
    },
    {
        "id": 26,
        "dim": "social",
        "text": "朋友带了一个你不认识的人一起玩，你通常？",
        "options": [
            {
                "key": "A",
                "text": "先静音观察，这是谁的物种",
                "score": -2
            },
            {
                "key": "B",
                "text": "看对方好不好接话",
                "score": 0
            },
            {
                "key": "C",
                "text": "主动开聊，不能让场子冷掉",
                "score": 2
            }
        ]
    },
    {
        "id": 27,
        "dim": "social",
        "text": "别人太快靠近你、问很多私人问题，你会？",
        "options": [
            {
                "key": "A",
                "text": "警报响了，请保持安全距离",
                "score": -2
            },
            {
                "key": "B",
                "text": "有点不适，但看关系",
                "score": 0
            },
            {
                "key": "C",
                "text": "还好，我没那么防备",
                "score": 2
            }
        ]
    },
    {
        "id": 28,
        "dim": "social",
        "text": "遇到真正信任的人，你希望关系变得很亲近吗？",
        "options": [
            {
                "key": "A",
                "text": "想，我需要灵魂同伙",
                "score": 2
            },
            {
                "key": "B",
                "text": "想靠近，但也怕太近",
                "score": 0
            },
            {
                "key": "C",
                "text": "不一定，我习惯留点距离",
                "score": -2
            }
        ]
    },
    {
        "id": 29,
        "dim": "social",
        "text": "你有负面看法但没说出来，通常是因为？",
        "options": [
            {
                "key": "A",
                "text": "我一般直接说，憋着难受",
                "score": 2
            },
            {
                "key": "B",
                "text": "怕气氛裂开，先忍一下",
                "score": 0
            },
            {
                "key": "C",
                "text": "不想暴露我的阴暗小角落",
                "score": -2
            }
        ]
    },
    {
        "id": 30,
        "dim": "social",
        "text": "你在不同人面前，会切换不同版本的自己吗？",
        "options": [
            {
                "key": "A",
                "text": "不太会，我基本原厂直出",
                "score": 2
            },
            {
                "key": "B",
                "text": "会微调，适应一下场合",
                "score": 0
            },
            {
                "key": "C",
                "text": "会，而且像开了多个账号",
                "score": -2
            }
        ]
    }
],
    archetypeNames: {
    "CSPOB": "CTRL-R｜重建者",
    "CSPOK": "TRANS｜疯译者",
    "CSPHB": "MUTE-FIX｜静修工",
    "CSPHK": "NASA-0｜冷观员",
    "CSDOB": "PLAN-B｜缓冲垫",
    "CSDOK": "LAZY-LAW｜摆烂法官",
    "CSDHB": "PATCH｜缝合师",
    "CSDHK": "NARR-OS｜旁白机",
    "CWPOB": "ELEC-FIX｜带电工",
    "CWPOK": "BOOM｜烟花脑",
    "CWPHB": "CRY-WORK｜泪工人",
    "CWPHK": "RADAR-SUB｜情潜艇",
    "CWDOB": "SOP-ANX｜流程焦虑",
    "CWDOK": "PING-PONG｜横跳机",
    "CWDHB": "SOFT-BUG｜温柔漏洞",
    "CWDHK": "NIGHT-CRT｜夜审官",
    "MSPOB": "LUCKY-HERO｜救世主",
    "MSPOK": "CUT-UP｜解构师",
    "MSPHB": "SLOW-OK｜慢交付者",
    "MSPHK": "DEEP-SEA｜潜水考古学家",
    "MSDOB": "TIDY-0｜废墟整理员",
    "MSDOK": "SOFA-SAGE｜摆烂哲学家",
    "MSDHB": "SAFE-BOX｜保安队长",
    "MSDHK": "LOW-BAT｜低电人",
    "MWPOB": "CHAOS-SUN｜发光体",
    "MWPOK": "STORM-X｜风暴制造机",
    "MWPHB": "BACKUP-BOT｜补位小机器人",
    "MWPHK": "MOON-RUIN｜看月亮的人",
    "MWDOB": "JELLY-FIX｜修补型水母",
    "MWDOK": "DANMU-X｜精神弹幕永动机",
    "MWDHB": "SAVE-ME｜自救练习生",
    "MWDHK": "UNI-EMO｜内耗诗人"
},
    resultText: {
    "self": {
        "left": "你不是不疯，你是疯得有目录。别人还在大喊“怎么会这样”，你已经开始给自己的崩溃编号、归档、写注释。",
        "right": "你的自我认知像凌晨三点的便利店灯牌：亮着，但闪。你知道自己有事，但很难把“有事”翻译成人类语言。"
    },
    "emotion": {
        "left": "你的情绪系统像一台旧但耐用的电饭煲，偶尔冒烟，但饭还是能熟。你会难过，但不一定立刻停机。",
        "right": "你的情绪像高灵敏度地震仪，别人轻轻跺脚，你这里已经显示板块运动。你不是矫情，是接收器太努力。"
    },
    "action": {
        "left": "你属于先把车推出去再研究刹车的人。计划可能还没长全，但你已经让事情开始在现实里滚动。",
        "right": "你的行动系统需要仪式感、心理热身和一点点宇宙许可。你不是废，你只是启动过程像老电脑开机。"
    },
    "social": {
        "left": "你不是时时刻刻外向，而是遇到对的频道会突然变成信号塔。你的表达欲平时睡觉，醒来时很吵。",
        "right": "你的社交电量不是低，是很贵。无效社交像后台偷跑的软件，会把你整个人的电池偷没。"
    },
    "world": {
        "left": "你看到混乱，会忍不住想给世界贴标签、打补丁、装支架。你可能也想尖叫，但会边尖叫边修。",
        "right": "你看世界像看一场没排练好的舞台剧：荒谬、认真、离谱，但大家都在装作流程合理。你负责看穿，并在心里配弹幕。"
    }
},
    summary: {
      self: { left: "你会给自己的崩溃写目录", right: "你还在把自己翻译成人类语言" },
      emotion: { left: "情绪底盘还算能扛", right: "情绪雷达特别敬业" },
      action: { left: "事情会被你推进现实", right: "启动前需要一点精神热身" },
      social: { left: "遇到对的频道会突然亮起来", right: "社交电量很贵，要省着用" },
      world: { left: "看到烂摊子会想修", right: "看到日常会自动生成弹幕" }
    },
    advice: {
      self: { left: "能自省是好事，但不要把自己活成故障报告。", right: "说不清自己时，先记录一个今天真的想靠近的东西。" },
      emotion: { left: "稳定不等于不用维护，别总把自己静音。", right: "脑内开庭时先别判死刑，喝水、睡觉、明天再说。" },
      action: { left: "你很会推进，但不是所有 bug 都要你修。", right: "把任务切小：打开、写一行、保存，都算开始。" },
      social: { left: "你能把场子点亮，也要记得关灯休息。", right: "无效社交会偷电，能少解释就少解释。" },
      world: { left: "建设很重要，但别在别人的废墟上贷款建楼。", right: "看穿荒谬之后，也可以给现实递一把螺丝刀。" }
    }
  }
};

export const abtiLocaleOptions = [abtiLocales.vi, abtiLocales.nan];
export const abtiDimensionOrder: AbtiDimensionKey[] = ["self", "emotion", "action", "social", "world"];
