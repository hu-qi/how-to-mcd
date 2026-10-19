"use strict";
// Community home-cooking GUIDE LIBRARY. Not official recipes or laboratory verified.
// Never derive a commercial formula from an official name, price, or nutrition entry.
(function (global) {
  const guides = [
    {
      id: "combo", match: /套餐|组合|双人餐|分享餐|全家餐|多人餐|桶餐|超值餐|一人食|随心配|欢聚|精选餐|工作餐|儿童餐|开心乐园餐/,
      title: "套餐/组合餐家庭拆解指南", minutes: null,
      ingredients: ["根据官方套餐详情逐一确定每个单品", "家庭厨房可提供的对应食材"],
      equipment: ["依据所选单品决定"],
      steps: [
        "先点击「查看详情」核对官方实际套餐组成、份量与可选配内容；不同门店、活动可能不同。",
        "将套餐中的主食、配菜、饮品、甜点逐项拆分，在本页分别搜索各单品名称并查看适用的社区家常指南。",
        "单品如需烹调，分别遵循适当的中心温度及生熟分离原则；饮品与熟食最后组合供应。",
        "若具体组成未公开，不得按套餐营销名称猜测食材或声称精准复刻。"
      ],
      safety: ["本指南只教如何拆分组合，不构成该套餐的完整配方。", "原商品可能包含不可从名称判断的过敏原及特别配料。"]
    },
    {
      id: "fries", match: /薯条|薯角|马铃薯条|土豆条/,
      title: "酥脆土豆条家庭做法", minutes: 35,
      ingredients: ["新鲜土豆", "食用油", "盐（按口味）"], equipment: ["空气炸锅或烤箱", "厨房纸巾"],
      steps: ["土豆洗净切均匀粗细的条，清水浸泡 10 分钟去除表面淀粉。", "充分沥干、擦干，再拌少量食用油。", "空气炸锅约 190–200°C 单层烹调 18–25 分钟，中途翻动，依尺寸和设备调整。", "表面金黄且内部熟软后出锅，少量撒盐，趁热食用。"],
      safety: ["注意高温烫伤，避免过度焦黑。", "不同门店的商业冷冻和加工工艺未知，口感不保证相同。"]
    },
    {
      id: "nuggets", match: /麦乐鸡|鸡块|鸡柳|鸡米花|鸡肉条/,
      title: "香酥鸡块家庭做法", minutes: 35,
      ingredients: ["去皮鸡胸肉", "鸡蛋", "面粉", "面包糠", "食用油和少量盐"], equipment: ["空气炸锅", "食品温度计"],
      steps: ["鸡肉切等大块，生熟砧板分开。", "依次裹面粉、打散的鸡蛋液和面包糠，表面刷少许食用油。", "空气炸锅约 190°C 烹调 12–16 分钟，中途翻面，以肉块尺寸为准。", "测量最大一块鸡肉中心温度达到至少 74°C，再食用。"],
      safety: ["鸡肉必须熟透：中心至少 74°C。", "含小麦和鸡蛋，不能把社区食谱的过敏原当作官方商品声明。"]
    },
    {
      id: "wings", match: /鸡翅|翅中|翅根|翅桶/,
      title: "烤鸡翅家庭做法", minutes: 45,
      ingredients: ["生鸡翅", "盐", "少量生抽", "食用油", "可选辣椒粉"], equipment: ["烤箱或空气炸锅", "食品温度计"],
      steps: ["鸡翅冷藏解冻，用厨房纸吸干，生肉器具分开。", "加入盐、生抽及少量油在冰箱冷藏腌制 20 分钟。", "空气炸锅约 190°C 烹调 20–26 分钟，中途翻面，时间随鸡翅大小调整。", "鸡翅靠近骨头最厚处中心达到至少 74°C，确认熟透后食用。"],
      safety: ["禽肉中心至少 74°C；测温探针避免直接触骨。", "酱油含大豆和可能的小麦。"]
    },
    {
      id: "fried-chicken", match: /炸鸡|鸡腿排|脆皮鸡|原味鸡|香骨鸡|鸡腿肉|鸡腿堡|板烧鸡/,
      title: "香煎或脆皮鸡腿家庭做法", minutes: 40,
      ingredients: ["去骨鸡腿肉", "盐", "少量食用油", "面粉（仅脆皮版）", "清水"], equipment: ["平底锅或空气炸锅", "食品温度计"],
      steps: ["将鸡腿肉整理成厚度均匀的肉排，在冰箱短暂冷藏调味。", "香煎版在平底锅少油中火煎两面；想要脆皮版可薄裹面粉后空气炸。", "根据肉排厚度烹调至中心达到至少 74°C，不能只凭颜色判断。", "如商品含面包，可另行烘热汉堡胚并加洗净的生菜组装。"],
      safety: ["鸡腿肉中心至少 74°C，避免交叉污染。", "商用腌料、调味料、成分比例未知。"]
    },
    {
      id: "fish", match: /麦香鱼|鱼柳|鱼堡|鳕鱼|鱼排|鱼块|深海鱼/,
      title: "香酥白身鱼家庭做法", minutes: 35,
      ingredients: ["去刺白身鱼片", "面粉", "鸡蛋", "面包糠", "少量食用油"], equipment: ["空气炸锅或烤箱", "食品温度计"],
      steps: ["鱼片解冻并吸干水分，检查鱼刺。", "鱼片依次裹面粉、蛋液和面包糠，轻刷食用油。", "在约 190°C 的空气炸锅中烹调 12–16 分钟，按厚度调整。", "鱼肉中心达到至少 63°C 后取出；可与烘热面包及自制酱汁组成家庭鱼柳堡。"],
      safety: ["鱼类中心至少 63°C。", "鱼、小麦、鸡蛋是本家庭版本的过敏原。"]
    },
    {
      id: "beef", match: /巨无霸|吉士|牛肉|安格斯|芝士堡|皇堡|汉堡包|汉堡/,
      title: "芝士牛肉汉堡家庭做法", minutes: 30,
      ingredients: ["牛肉馅", "汉堡胚", "芝士片", "洋葱", "生菜", "酸黄瓜"], equipment: ["平底锅", "食品温度计"],
      steps: ["牛肉馅分成均等肉饼，准备洗净蔬菜并烘热面包胚。", "肉饼在平底锅用中火煎至两面上色。", "用温度计确认牛肉馅肉饼最厚处至少 71°C，临起锅覆盖芝士片。", "按家庭口味加入生菜、洋葱与酸黄瓜组装；未知商业酱料不声称可完全复制。"],
      safety: ["牛肉馅中心至少 71°C。", "注意小麦、奶类、酱料过敏原。"]
    },
    {
      id: "sausage-egg", match: /麦满分|猪柳|炒蛋|早餐堡|蛋堡|煎蛋|鸡蛋麦芬|早餐麦芬/,
      title: "早餐麦芬/蛋芝士家庭做法", minutes: 20,
      ingredients: ["英式麦芬", "鸡蛋", "芝士片", "按需选择熟制火腿或香肠"], equipment: ["不粘锅", "锅铲", "烤面包机"],
      steps: ["将英式麦芬切开，在干净的平底锅烘热。", "鸡蛋煎至蛋白与蛋黄完全凝固。", "如用熟制肉片，按包装要求加热透；非即食肉必须完全烹熟。", "将麦芬、热鸡蛋、芝士及熟制肉片组装，趁热食用。"],
      safety: ["鸡蛋要完全凝固，肉类依其类型达到安全熟度。", "含小麦、鸡蛋及奶类。"]
    },
    {
      id: "wrap", match: /卷饼|鸡肉卷|薄饼|麦饼|塔可|墨西哥卷/,
      title: "家庭鸡肉卷饼参考做法", minutes: 30,
      ingredients: ["市售熟制薄饼皮", "鸡胸或鸡腿肉", "洗净生菜", "番茄", "少量酸奶酱"], equipment: ["平底锅", "食品温度计"],
      steps: ["将鸡肉切成易熟的小片，平底锅煎至中心至少 74°C。", "薄饼皮依包装说明充分加热，蔬菜清洗沥干。", "将熟鸡肉、蔬菜和少量酱料放在饼皮中央。", "折叠两侧后卷紧，切半装盘；组合与酱料仅代表家庭版本。"],
      safety: ["鸡肉中心至少 74°C。", "饼皮含小麦，酱料可能含奶类或鸡蛋。"]
    },
    {
      id: "rice", match: /饭|米饭|盖浇|饭碗|粥|米粥/,
      title: "家庭饭碗/早餐粥参考做法", minutes: 35,
      ingredients: ["大米", "饮用水", "按商品类型自选已熟透的蛋白质或蔬菜"], equipment: ["电饭锅或小锅"],
      steps: ["先辨认商品究竟是米饭还是粥；商业配比未知时不复制名称里的未明配料。", "大米按包装说明洗净，米饭用电饭锅煮熟；粥额外增加饮用水并煮至米粒熟软。", "荤菜与蔬菜另外按其安全要求烹饪，完全熟透后再加入。", "趁热食用；剩余米饭尽快冷却冷藏，重新加热需彻底热透。"],
      safety: ["熟米饭不要在室温久放，避免蜡样芽孢杆菌风险。", "未知搭配和特制酱料不作官方配方声明。"]
    },
    {
      id: "salad", match: /沙拉|生菜杯|蔬菜杯|蔬菜沙拉/,
      title: "家庭蔬菜沙拉参考做法", minutes: 15,
      ingredients: ["新鲜生菜", "小番茄", "黄瓜", "按需食用油与醋"], equipment: ["砧板", "沙拉碗"],
      steps: ["在食用前彻底清洗可生食蔬菜，沥干。", "将蔬菜切成适口大小，用干净的沙拉碗混合。", "少量加入食用油、醋或另备自制酱汁。", "如添加鸡肉，先另行加热至中心至少 74°C，避免污染生食蔬菜。"],
      safety: ["生食蔬菜注意清洗及冷藏。", "酱汁过敏原随使用品牌而异。"]
    },
    {
      id: "apple-pie", match: /苹果派|菠萝派|香芋派|红豆派|派$/,
      title: "酥皮水果派家庭参考做法", minutes: 45,
      ingredients: ["市售酥皮", "所选水果或可熟制馅料", "少量糖", "玉米淀粉", "刷面用鸡蛋（可选）"], equipment: ["烤箱", "烤盘"],
      steps: ["将选择的馅料切碎，用小锅煮至熟软；水果可加少量糖和玉米淀粉收浓。", "馅料冷却后包进已按包装说明解冻的酥皮，压紧边缘并留排气孔。", "约 200°C 烤箱烘烤 18–23 分钟，直至酥皮金黄、内馅完全热透。", "出炉充分冷却后食用，避免热馅烫伤。"],
      safety: ["热馅可能造成严重烫伤。", "市售酥皮可能含小麦、奶和大豆。"]
    },
    {
      id: "pie-dessert", match: /蛋挞|派|酥卷|麻花|甜甜圈|多拿滋|炸面包/,
      title: "家庭烘焙甜点品类参考", minutes: 45,
      ingredients: ["面粉或按类型选购的酥皮", "鸡蛋", "牛奶（如适用）", "少量糖"], equipment: ["烤箱", "烤盘"],
      steps: ["确认商品是酥皮、面团或蛋奶馅类别，不同结构不能直接混用食谱。", "选用对应的家庭烘焙配方并按标示比例制作，严格分隔生蛋与熟食。", "用烤箱加热至面团完全烘熟、含蛋馅凝固；温度和时长以实际食谱为准。", "出炉适当冷却，检查过敏原后供应。"],
      safety: ["原商品的馅料配方未知，不能声称精准复刻。", "常见过敏原有小麦、奶和鸡蛋。"]
    },
    {
      id: "ice-cream", match: /甜筒|冰淇淋|雪糕|圣代|麦旋风|冰激凌|冰激淋/,
      title: "家庭冰淇淋/圣代参考做法", minutes: 10,
      ingredients: ["正规购买的巴氏杀菌冰淇淋或原味冰淇淋", "自选可食用坚果/饼干碎/果酱（视品种）"], equipment: ["冷冻碗", "冰淇淋勺"],
      steps: ["为保障家庭制作食品安全，优先使用符合冷链要求的现成正规冰淇淋作基底，不声称复制品牌奶浆。", "冷冻碗预冷；按个人喜好取冰淇淋。", "可选加入少量饼干碎、果酱、坚果等家常配料（不等于官方商品构成）。", "制作后立即食用；不要反复融化和重新冻结。"],
      safety: ["奶类及其他过敏原因基底和配料而异。", "严格冷链，不建议使用未经巴氏杀菌的生蛋/生乳。"]
    },
    {
      id: "milkshake", match: /奶昔|雪冰|冰沙|冰奶/,
      title: "家庭冰沙/奶昔参考", minutes: 8,
      ingredients: ["巴氏杀菌牛奶或酸奶", "可食用冰块或冷冻水果", "按口味少量糖"], equipment: ["料理机", "杯子"],
      steps: ["确定所选品类是奶昔还是冰沙，商业原料比例未知。", "在卫生的料理杯内放入巴氏杀菌乳制品和少量合适的水果或冰块。", "短时搅打至顺滑，依据个人喜好调整稠度。", "立即饮用，避免常温久放。"],
      safety: ["奶类过敏原；冰块必须符合饮用水卫生要求。", "不添加未经巴氏杀菌的生乳。"]
    },
    {
      id: "latte", match: /拿铁|卡布奇诺|澳白|馥芮白|玛奇朵/,
      title: "家庭牛奶咖啡参考做法", minutes: 10,
      ingredients: ["意式浓缩咖啡或浓咖啡", "巴氏杀菌牛奶"], equipment: ["咖啡机或咖啡壶", "奶泡壶"],
      steps: ["按饮用习惯萃取一份咖啡，或用过滤咖啡替代。", "将巴氏杀菌牛奶加热至适宜饮用温度，适量打发奶泡。", "在杯中混合咖啡与热牛奶，按个人口味调整比例。", "避免过烫饮用；儿童、孕期等人群应关注咖啡因摄入。"],
      safety: ["含奶及咖啡因；不适合需要限制咖啡因摄入者。"]
    },
    {
      id: "coffee", match: /美式|咖啡|浓缩|冷萃|冰醇/,
      title: "家庭咖啡参考做法", minutes: 10,
      ingredients: ["烘焙咖啡豆或咖啡粉", "洁净饮用水", "可选冰块"], equipment: ["咖啡机或手冲壶"],
      steps: ["按家庭咖啡机说明研磨咖啡豆或准备咖啡粉。", "以洁净饮用水冲煮咖啡；冰饮需用可饮用水制成的冰块。", "依据个人喜好适量稀释或冷却。", "按照健康状况合理控制咖啡因摄入。"],
      safety: ["咖啡因含量与具体产品和冲泡参数不同。", "热水和热咖啡注意防烫伤。"]
    },
    {
      id: "tea", match: /奶茶|红茶|绿茶|乌龙|茉莉|果茶|热茶/,
      title: "家庭茶饮参考做法", minutes: 12,
      ingredients: ["可食用茶叶或正规茶包", "洁净饮用水", "可选巴氏杀菌牛奶/水果"], equipment: ["茶壶", "滤网"],
      steps: ["用洁净的热水按茶叶包装冲泡，滤去茶渣。", "奶茶可添加巴氏杀菌牛奶，果茶可加入洗净切好的水果。", "调整温度后饮用，冷热饮均要注意食材卫生。", "无法从官方商品名称推断品牌糖浆配方或糖量，家庭版本不保证同味。"],
      safety: ["奶茶可能含奶类及咖啡因。", "注意热水烫伤和果切食材储存。"]
    },
    {
      id: "hot-chocolate", match: /热巧|巧克力饮|可可饮/,
      title: "家庭热可可参考做法", minutes: 8,
      ingredients: ["无糖可可粉", "巴氏杀菌牛奶", "少量糖"], equipment: ["奶锅", "搅拌器"],
      steps: ["可可粉先加少量温水搅匀成糊。", "奶锅小火加热牛奶至适宜饮用的温度，加入可可糊。", "搅拌均匀后按个人口味加少量糖。", "稍稍降温后饮用，避免烫伤。"],
      safety: ["含奶类，商业风味粉和糖浆组成未知。"]
    },
    {
      id: "juice", match: /橙汁|苹果汁|果汁|柠檬饮|柠檬水|果饮|饮料|气泡水|苏打|可乐|雪碧|芬达/,
      title: "家庭果饮/气泡饮替代参考", minutes: 5,
      ingredients: ["洁净饮用水", "洗净的水果", "可选符合食用标准的气泡水"], equipment: ["干净水杯"],
      steps: ["先确认商品是果汁、气泡饮还是包装饮品；无法复制未知的商业浓缩汁、糖浆或碳酸饮料配方。", "家庭替代方案可在洁净饮用水或气泡水中加入新鲜柠檬/橙片等洗净水果。", "冰饮使用符合饮用水卫生要求的冰块。", "仅标注为家庭替代饮品，不应与官方产品的营养值或口味混为一谈。"],
      safety: ["商用品牌配方无法据产品名复刻。", "碳酸、糖量及过敏原应按实际购买的原料标签判断。"]
    },
    {
      id: "plain-water", match: /饮用水|矿泉水|纯净水/,
      title: "原包装饮用水：无需烹饪", minutes: 0,
      ingredients: ["符合饮用水标准的产品"], equipment: ["干净水杯（可选）"],
      steps: ["饮用水属于成品饮料，不存在需要“复刻”的商业烹调步骤。", "选购符合饮用水卫生标准的正规包装水并按标签储存。", "开启后注意清洁，避免交叉污染。"],
      safety: ["不将不符合饮用标准的水当作即饮水。"]
    },
    {
      id: "corn", match: /玉米杯|甜玉米|玉米棒/,
      title: "家庭蒸甜玉米参考做法", minutes: 20,
      ingredients: ["鲜甜玉米", "洁净饮用水"], equipment: ["蒸锅"],
      steps: ["将玉米去掉外层老皮，清洗表面。", "蒸锅加水烧开后放入玉米，蒸约 12–18 分钟，依玉米大小和嫩度调整。", "确认玉米粒完全熟软后取出并稍微冷却。", "按个人口味食用，不代表商业调味工艺。"],
      safety: ["蒸汽和玉米均可能烫伤。"]
    },
    {
      id: "hash-brown", match: /薯饼|薯球|土豆饼/,
      title: "家常土豆饼参考做法", minutes: 30,
      ingredients: ["土豆", "少量面粉或淀粉", "食用油", "盐"], equipment: ["平底锅"],
      steps: ["将土豆擦丝，用清水稍冲后沥去多余水分。", "加入少量淀粉和盐拌匀，压成薄饼。", "平底锅放少许油中火煎至两面金黄。", "确认内部熟透、外层不焦黑后趁热食用。"],
      safety: ["高温油锅注意防烫。", "使用面粉时需核对小麦过敏原。"]
    },
    {
      id: "soup", match: /汤|浓汤|粟米羹/,
      title: "家庭热汤参考做法", minutes: 25,
      ingredients: ["对应蔬菜", "洁净饮用水", "少量盐", "可选巴氏杀菌牛奶"], equipment: ["汤锅"],
      steps: ["依据可确认的商品类型选用对应蔬菜，未明成分不应擅自推定。", "洗净切小块，加水煮至蔬菜软熟。", "想制作浓汤可适量搅打后再充分加热。", "按需加入少量牛奶调味，注意奶类过敏原。"],
      safety: ["热汤与搅拌机谨防烫伤。", "肉类配料如有必须按类型达到安全温度。"]
    },
    {
      id: "cookie-cake", match: /曲奇|饼干|蛋糕|松饼|华夫|布朗尼|玛芬|麦芬蛋糕|巧克力蛋糕/,
      title: "家庭小烘焙参考做法", minutes: 40,
      ingredients: ["面粉", "鸡蛋", "巴氏杀菌牛奶", "糖", "少量油"], equipment: ["烤箱", "烤模"],
      steps: ["先确认商品属于蛋糕、饼干或松饼，不同品类需要不同配方。", "可以使用正规家庭烘焙食谱按克数配比，不尝试反推品牌商用配方。", "按家庭食谱要求预热烤箱并烘焙至内部熟透、无生面糊。", "冷却后食用，未食用部分妥善保存。"],
      safety: ["注意小麦、鸡蛋和奶类过敏原。", "生面粉和生蛋液不得生食。"]
    },
    {
      id: "other", match: null, title: "尚无可核实的专属家庭复刻方法",
      minutes: null, ingredients: [],
      equipment: [],
      steps: [
        "目前仅能确认本商品存在于选定门店的官方实时菜单，不能从名称、价格或营养信息推定它的全部配料和商业制作工艺。",
        "打开上方「查看详情」了解官方公开的套餐组成；如有明确单品，可查找相近的社区原创食谱或参考指南。",
        "如希望补齐此商品，请通过 GitHub 提交公开可验证的食材来源、家庭配方和真实厨房实测记录。",
        "在证据充分之前，不会输出虚构的配料克数、烹饪温度或冒称的商业配方。"
      ],
      safety: ["过敏原与食品安全信息未知，请以官方商品标签及个人情况核实。"]
    }
  ];

  // A related, fully quantified *community* recipe (not a product match).
  // Some guide types (combos, water, unclassified products) intentionally
  // have no matching standalone recipe. Never imply brand recipe accuracy.
  const recipeByGuideId = Object.freeze({
    fries:"crispy-fries", nuggets:"chicken-nuggets", wings:"chicken-wings",
    "fried-chicken":"chicken-burger", fish:"fish-sandwich",
    beef:"beef-burger", "sausage-egg":"breakfast-muffin",
    wrap:"chicken-wrap", rice:"breakfast-porridge",
    salad:"garden-salad", "apple-pie":"apple-turnover",
    "ice-cream":"ice-cream-sundae", milkshake:"fruit-milkshake",
    latte:"milk-latte", coffee:"drip-coffee", tea:"fruit-tea",
    "hot-chocolate":"hot-cocoa", juice:"sparkling-lemonade",
    corn:"steamed-corn", "hash-brown":"potato-hashbrown",
    soup:"vegetable-soup", "cookie-cake":"oat-cookies",
    "pie-dessert":"oat-cookies"
  });
  // Order matters: specific products before generic '汉堡', '派', '咖啡', etc.
  function resolve(productName, categoryName = "") {
    const name = String(productName || "").slice(0, 200);
    // Avoid treating a broad category as proof of the exact commercial formula.
    const category = String(categoryName || "").slice(0, 100);
    const matched = guides.find(g => g.id !== "other" && g.match.test(name));
    // Only infer from *narrow, unambiguous* official categories. A generic
    // category such as "汉堡" cannot justify guessing the meat is beef.
    const safeCategoryIds = new Set([
      "fries", "nuggets", "wings", "fish", "ice-cream", "coffee",
      "tea", "corn", "hash-brown", "plain-water"
    ]);
    const categoryGuide = guides.find(g => safeCategoryIds.has(g.id) && g.match.test(category));
    const inferred = matched || categoryGuide || guides[guides.length - 1];
    return {
      productName: name,
      title: inferred.title,
      id: inferred.id,
      relatedRecipeId: recipeByGuideId[inferred.id] || null,
      status: inferred.id === "other" ? "unknown" : "category",
      source: "社区非官方家庭参考；不是麦当劳商业配方，未经过本项目实测验证",
      ingredients: [...inferred.ingredients],
      equipment: [...inferred.equipment],
      steps: [...inferred.steps],
      minutes: inferred.minutes,
      safety: [...inferred.safety]
    };
  }
  const api = Object.freeze({ resolve, guideCount: guides.length });
  global.HowToMCDGuides = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
