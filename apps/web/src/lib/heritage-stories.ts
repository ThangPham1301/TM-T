type StorySection = { heading: string; text: string };

export type HeritageStory = {
  category: string;
  label: string;
  shortTitle: string;
  summary: [string, string];
  linkLabel: string;
  image: { slug: string; alt: string };
  title: string;
  lead: string;
  paragraphs: string[];
  sections?: StorySection[];
  quote?: string;
};

export const heritageStories = [
  {
    category: "me-xung-keo-hue",
    label: "Mè xửng Huế",
    shortTitle: "Mè xửng và ngọn lửa liu riu",
    summary: [
      "Mùi mè rang quyện với mạch nha sôi liu riu gợi nhớ những chiều mưa bên sông Hương.",
      "Miếng mè xửng dẻo thơm, bùi vị đậu phộng hay ấm nhẹ vị gừng, vừa vặn để thưởng thức cùng chén trà nóng.",
    ],
    linkLabel: "Khám phá mè xửng Huế",
    image: {
      slug: "me-xung-hue",
      alt: "Mè xửng vàng phủ mè rang bên lát gừng tươi và túi giấy kraft",
    },
    title: "Ngọn lửa liu riu và cái dẻo thương nhớ của Kinh kỳ",
    lead: "Có người nói, muốn hiểu tính cách người Huế, chỉ cần chậm rãi nhai một miếng mè xửng. Bên ngoài dịu dàng, càng nhai càng thấy cái dẻo dai và hậu vị thơm bùi còn đọng lại.",
    paragraphs: [
      "Trên những con phố nhỏ ven bờ bắc sông Hương, mùi mè rang vàng hòa cùng hơi ấm từ chảo mạch nha sôi liu riu là mùi hương đánh thức ký ức Cố đô. Làm mè xửng không thể vội. Người thợ phải kiên nhẫn canh lửa, khuấy đều cho đến khi đường, mạch nha và bột đạt độ dẻo trong như hổ phách. Khi ấy, vị bùi của đậu phộng rang, hương thơm của mè trắng hay cái cay dịu của gừng mới quyện đều vào từng miếng kẹo.",
      "Với nhiều người đi xa, mè xửng là vị ngọt của những chiều mưa Huế se lạnh, khi cả nhà quây quần bên hiên và nghe tiếng mưa trên mái ngói liệt. Miếng kẹo dẻo ấy thường đi cùng một chén trà ấm, đủ để câu chuyện trong nhà kéo dài thêm đôi chút.",
      "Gói Huế mang hương vị mộc mạc ấy đến những dịp gần gũi hơn. Một miếng mè xửng có thể theo bạn đến bàn làm việc, lên chuyến tàu hay góp mặt trong buổi trà chiều cùng bạn bè. Nhấm nháp chậm, bạn sẽ nhận ra vị ngọt của mạch nha, cái bùi của đậu phộng và chút ấm áp quen thuộc của gừng.",
    ],
    quote:
      "Một miếng mè xửng đủ để nhớ một chiều sông Hương, cũng đủ gọn để mang theo bên mình mỗi ngày.",
  },
  {
    category: "banh-cung-dinh",
    label: "Mứt & Bánh Huế",
    shortTitle: "Gói mùa nắng dưới hiên nhà rường",
    summary: [
      "Chiếc bánh in chạm hoa văn và đĩa mứt ngọt thanh gợi lại bàn trà tiếp khách trong nếp nhà Huế.",
      "Vị bùi của đậu xanh và hơi ấm của gừng hợp với một buổi trà chiều thong thả.",
    ],
    linkLabel: "Khám phá mứt và bánh Huế",
    image: {
      slug: "mut-banh-hue",
      alt: "Bánh in hoa sen, mứt sen và mứt gừng bày trên đĩa gốm",
    },
    title: "Gói mùa nắng ngọt thanh dưới hiên nhà rường",
    lead: "Nếu mè xửng gợi sự quyến luyến của những chiều mưa, thì bánh mứt Huế gợi sự khéo léo và lòng hiếu khách gửi trong từng khuôn bánh, từng hạt sen trong veo.",
    paragraphs: [
      "Trong nếp nhà Huế xưa, chiếc đĩa bánh mứt trên bàn tiếp khách luôn được chuẩn bị cẩn thận. Đậu xanh đãi vỏ được hấp chín, nghiền mịn rồi ép trong khuôn gỗ chạm hoa văn. Sen được sên đường với lửa nhỏ, còn gừng non được làm thành những lát mứt giữ vị cay ấm. Mỗi món cần một nhịp tay và sự kiên nhẫn riêng.",
      "Cái duyên của bánh mứt xứ Huế nằm ở vị thanh mà sâu. Bánh in đậu xanh vừa chạm môi đã tan mịn, để lại vị bùi mộc mạc. Một lát mứt gừng cho dư vị ấm hơn, còn mứt sen dịu nhẹ khi dùng cùng trà. Những hương vị nhỏ ấy khiến buổi chuyện trò bên bàn tiếp khách thêm thong thả.",
      "Gói Huế đưa thức bánh mứt từ dịp lễ Tết về với những cuộc gặp thường ngày. Hộp bánh giản dị có thể đặt trên bàn trà bên cửa sổ hoặc mang theo làm món quà nhỏ cho người phương xa. Mỗi lần mở hộp là một dịp để nhớ đến nếp tiếp khách mộc mạc và tinh tế của xứ Huế.",
    ],
    sections: [
      {
        heading: "Hồn cổ kính được gìn giữ",
        text: "Hoa văn khuôn bánh truyền thống và cách chế biến chậm rãi giúp giữ nét riêng của từng nguyên liệu.",
      },
      {
        heading: "Thưởng thức trong đời sống hôm nay",
        text: "Bánh và mứt có thể dùng riêng hoặc bày cùng trà ấm, vừa cho buổi gặp mặt thân tình, vừa để gửi người phương xa.",
      },
    ],
  },
  {
    category: "tra-cung-dinh",
    label: "Trà Huế",
    shortTitle: "Một khoảng lặng bên chén trà Huế",
    summary: [
      "Sắc trà vàng trong và hương thảo mộc gợi một buổi sớm bên sông Hương.",
      "Một ly trà ấm, thêm miếng mè xửng hay bánh in, đủ để ngồi lại giữa một ngày bận rộn.",
    ],
    linkLabel: "Khám phá trà Huế",
    image: {
      slug: "tra-hue",
      alt: "Ly trà cung đình vàng óng bên túi lọc và đĩa thảo mộc",
    },
    title: "Một khoảng lặng giữa phố thị cùng hương ngự thiện",
    lead: "Bên chén trà, người Huế dành cho mình một khoảng lặng. Hơi trà ấm và hương thảo mộc làm dịu nhịp của một ngày vội vã.",
    paragraphs: [
      "Lấy cảm hứng từ nếp thưởng trà cung đình, Trà Huế gợi nhớ những vị thảo mộc quen thuộc. Khi nước nóng chạm vào trà, sắc nước dần chuyển sang màu vàng hổ phách trong trẻo. Làn hơi mỏng và hương thơm dịu gợi một buổi sớm có sương trên mặt sông Hương.",
      "Giữa guồng quay bận rộn của thành phố, đôi khi ta bỏ qua thói quen uống trà vì ngại đong thảo mộc, tráng ấm và chờ hãm. Một tách trà túi lọc làm việc ấy giản dị hơn. Chỉ cần một ly nước nóng ngay tại bàn làm việc hoặc bên trang sách, bạn đã có thể thong thả chờ trà tỏa hương.",
      "Trà Cung Đình Túi Lọc của Gói Huế dành cho những khoảnh khắc gần gũi như thế. Nhấp một ngụm trà ấm, thêm một miếng mè xửng hoặc bánh in đậu xanh, bạn sẽ thấy hương vị Cố đô có thể hiện diện ngay trong một ngày bình thường.",
    ],
    quote:
      "Không cần một buổi trà đạo cầu kỳ. Chỉ một ly trà ấm cũng đủ để dành cho mình vài phút thong thả.",
  },
  {
    category: "qua-bieu",
    label: "Quà biếu",
    shortTitle: "Nếp gấp gửi một chút Huế",
    summary: [
      "Nếp gấp ánh vàng, đai giấy nâu và nền kem mộc gợi vẻ trang nhã của một món quà Cố đô.",
      "Mỗi hộp quà gửi theo chút hương vị Huế và lời cảm ơn dành cho người nhận.",
    ],
    linkLabel: "Chọn hộp quà biếu",
    image: {
      slug: "qua-bieu",
      alt: "Hộp quà màu kem, đai nâu và góc vàng đồng bên phong thư giấy mộc",
    },
    title: "Nếp gấp gói trọn một mảnh trời sông Hương",
    lead: "Một món quà xứ Huế gửi theo sự kính trọng, lòng tinh tế và lời chúc bình an được gói ghém cẩn trọng bằng cả hai tay.",
    paragraphs: [
      "Có bao giờ bạn đứng trước nhiều món quà mà vẫn chần chừ? Một món quà đáng nhớ thường bắt đầu từ cảm giác người nhận được nghĩ đến. Trong nếp trao quà Cố đô, hình thức trang nhã, hương vị chỉn chu và câu chuyện đi cùng món quà đều góp phần thể hiện tấm lòng của người tặng.",
      "Hộp Quà Hương Huế lấy cảm hứng từ nền giấy kem gợi màu vôi tường cổ, đai giấy nâu trầm và nếp gấp ánh vàng đồng. Khi trượt lớp đai và mở nắp, người nhận có thể nhớ đến một buổi trà chiều xứ Huế. Vị dẻo thơm của mè xửng, cái bùi của bánh in và hương trà thảo mộc là những thức quà gợi nên câu chuyện ấy.",
      "Dù trao cho cha mẹ nơi quê nhà, gửi lời cảm ơn đến đối tác, hay mang về cho đồng nghiệp sau chuyến đi Huế, người tặng đều có thể gửi theo một lời nhắn riêng. Món quà mở đầu cho câu chuyện về miền đất, về cuộc gặp và về người đã chọn quà.",
    ],
    sections: [
      {
        heading: "Khi tặng người thân và bạn bè",
        text: "Trao quà cũng là dịp ngồi lại, pha một ấm trà và cùng nhau thưởng thức những vị quen của Huế.",
      },
      {
        heading: "Khi biếu tặng đối tác và khách quý",
        text: "Nếp gấp trang nhã và câu chuyện Cố đô tạo nên một cách gửi lời cảm ơn có dấu ấn riêng.",
      },
    ],
    quote:
      "Từ Huế vươn xa, mang di sản đến mọi nơi, lan tỏa món quà Huế, tâm hồn Huế.",
  },
] satisfies [HeritageStory, HeritageStory, HeritageStory, HeritageStory];

export function storyForCategory(category: unknown): HeritageStory | undefined {
  return heritageStories.find((story) => story.category === category);
}
