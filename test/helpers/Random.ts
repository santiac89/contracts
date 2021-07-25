const addresses = [
  '0xE800ff2538cE645bE278338c372E69C1093f36Ef',
  '0x85F04349806B0f61eE81ba2c2DDDB951Ccc0a263',
  '0xB6Fc3833F2f3DAA7A9CDad41Eead62fb9f388241',
  '0xB868EDbf5C9FE478b0F42ca8caAD24E359950f4e',
  '0x7fd0f9e0fFa97BDD14C75085d02D8eDEF8F6Bc54',
  '0x6A2A125f554E2dd47DEA043C6245274fBcf7eaef',
  '0x9fCE2F4a5Fc156E6e1AC1E31AED397be4EABd4F4',
  '0x249c66A5EF8Df12b3522Fd453C0590e0352eB1EB',
  '0xbA9A47500b09e5D2aA4cB2d39D61bAf029DdEEE0',
  '0x4c7b17C392f11D21a801e067E93d857f1DcEB057',
  '0xFA3E8D917a77cEA368fc6Af904E5E7dd9a6351D9',
  '0x7F48fA125AAa6C529617bb1A4a489e3E9c87eCd8',
  '0x3a910087c86ebF0b0eB31632065c337248CEA9ff',
  '0xCB4f732Bd66A3A8E0d50C3BB654D1ae0daeeC760',
  '0x856D15d7F743a14f66BE8FDca7636D558DbBBf1f',
  '0xb10361Da7201e81cD7bD053e70B189B54A19B811',
  '0x6025F34aFe038CC55Bcf5A916223136E8a5e47D4',
  '0x8E43fb388b2EE945F617d4D36008FA52B546E79E',
  '0x17eE41A22a32767D6A2Ae048F8B85EDb04f85555',
  '0x9728609Fe0107fA1241E4958c14748F33C965463',
  '0x1A8138F699D780578a8B503B0B53F6fD036bF564',
  '0xe89CbfB3AabC8B5d4f32a1231053654B42522E55',
  '0x4e88a0152dB728d07524ba39C35DcBFe3279F845',
  '0xE453c63299De627f8504947eB2E5c477b5D8FD93',
  '0x59F91f02F4a2867491Df07AB51F959D5C6234384',
  '0xf06Ea7cB3064E25f3f43198E0FbD0cC274a8b0b5',
  '0xe643076846BD00e2c21a8e6fB82F7aE874F51310',
  '0xe9C22263CBE27Ca7520266b4e2eaBf05A42f742f',
  '0x1cCB4Cce7e02305dc232076F3441d67A292c18D5',
  '0xE0B6529De182Cb0E68Dc985CAd07d50db3db0E3c',
  '0xF95A33da85C07aCb35E78419AEBa00310Deb9Ed6',
  '0x0642e2a4492FD28a77f8acf1CCF1B53698961A61',
  '0x93407f48D3Fe4821fa0Cd8F80978a6a81C925894',
  '0xfDEDc75Ebd2D5786138fD7F46788bD9027749c07',
  '0x5D13fCB60e3D5203D9E11042048b23b011F15A91',
  '0xABa61655a3505352C0ECD56AD51fe8625b8168B8',
  '0xa3e0b6eE3Ec650f1D0AE39f2405575882d5C79EA',
  '0x0f2DDa866D6a92abeABBe78EEd123974A60413F3',
  '0x88c83f95bf1561aAb64FcCAa71cEdCB0538Da4f8',
  '0xb390CF3A6B1985004939048Abf639c77185fe7D5',
  '0x7e280465537156226cD64E858dC4Bf9F28be8976',
  '0xf1FfCa6957ae64bE71E295dd383e3AbA91f79870',
  '0x2690ADAFa4e8C99CeC2F6c5431335521BD33aa19',
  '0x4439E1359e168f81dC8B3a2404246b8848AE6b54',
  '0xb109348dD1B25BCf428C0F6fbbCcf71cfb7c28A1',
  '0xd69985a74b6e992C5c100c09a1095c7f51523206',
  '0x7e23A3eaC52b68B876aAec69F951A0903ce3A870',
  '0x36F35A77Ac830Acd912054569541F8110dDe5A51',
  '0xAf9c83F144A39C840533337Ad7DD428d8031b5fA',
  '0xBea92cAd756c752bB0E81581E537B155Df9A56B9'
]

const numbers = [
  0.7205368692834257, 0.1728073564792394, 0.1978637574105196, 0.6554724489076624, 0.2723732305862797,
  0.2836436611202746, 0.9658350571520075, 0.8362894550871384, 0.8295572945101737, 0.8318129585741012,
  0.2306635574537616, 0.0969890314930217, 0.8860385124786117, 0.0943007330120379, 0.8181182349876603,
  0.2024872774422112, 0.8184895753723525, 0.1017982923909712, 0.3541510781828817, 0.7201141086399288,
  0.7861228090269747, 0.0964181915747875, 0.4378715313822377, 0.5715849325807389, 0.4304337153479501,
  0.2386147242719973, 0.8589423339717261, 0.1331799943305742, 0.0678670275374493, 0.4037186299591945,
  0.8324983687339081, 0.4056755106985386, 0.0547822407435206, 0.1167029836455529, 0.3871205371885026,
  0.1360352484982782, 0.3102643558017679, 0.0983213291579457, 0.9270905115910692, 0.4539153727073948,
  0.9111643665370013, 0.7180382213993959, 0.7373199800632252, 0.3636685923016119, 0.2536259160044112,
  0.8651464788703104, 0.9437617573313755, 0.8148165924788267, 0.6932326035933918, 0.8237179160341652,
  0.2598868730046936, 0.3839768106497201, 0.9727338374627437, 0.7618048602247531, 0.5626239376300886,
  0.2509003967107928, 0.7085099692114745, 0.1728332526947184, 0.4535988481969895, 0.9107548822767129,
  0.4824435593201586, 0.9033603025100592, 0.4630600607334403, 0.3681144490632444, 0.3013694075930221,
  0.6389364826235184, 0.4031501466924234, 0.3619099371204373, 0.1129358121398031, 0.7926506573395222,
  0.4656150830996806, 0.3267353615735224, 0.5646055583484761, 0.1059382115594689, 0.5438827278909882,
  0.2065279089830383, 0.7741206259388367, 0.7682657495060064, 0.2653296770692094, 0.8216765323175816,
  0.1436433449100835, 0.6206415186144079, 0.0228208005380846, 0.5654208713875173, 0.3173610886262881,
  0.0719885208612558, 0.9913916283270721, 0.8708645335110341, 0.7411719106718062, 0.7177411117306425,
  0.6198054052274853, 0.3737146152377966, 0.0834730663956617, 0.8589088400274896, 0.5303702696568382,
  0.4606813386930342, 0.1917267754835612, 0.8353915890441819, 0.8315168843091709, 0.5942599294414261,
  0.1822278050213715, 0.7487305445457555, 0.4427343496470707, 0.9310548457474179, 0.2596229154144733,
  0.1288049108246103, 0.7864389027729197, 0.1901686010007715, 0.5124594544942829, 0.7375992607803616,
  0.8353898423952222, 0.2802019920932956, 0.4309111159487474, 0.8003264540044945, 0.9635461960436369,
  0.6602007836521675, 0.6122458889514628, 0.0444270098519911, 0.4018571307011126, 0.6867099713776159,
  0.7546209134208139, 0.8379833364830036, 0.9627070286573574, 0.8367656426338577, 0.3829601119724566,
  0.8201581713698376, 0.4947878185053237, 0.4496683428671047, 0.9215494274934823, 0.5038174502801809,
  0.6753284670173929, 0.1639656637735954, 0.0633637693441533, 0.5628420440079704, 0.6679843837109552,
  0.1539918316911086, 0.1654947280955663, 0.3567232295825369, 0.7080069501829127, 0.8382041719619073,
  0.7568710606592599, 0.8572743889537775, 0.6485584660912933, 0.3828086986000463, 0.3210163814190583,
  0.4278363428735923, 0.0780359713002095, 0.7842849151827429, 0.6825826715232668, 0.5541759634599206,
  0.6603582549995062, 0.7686984394609766, 0.3219771681642134, 0.8044224210509034, 0.4777992841900054,
  0.8793045685850704, 0.3607932061814716, 0.2226644178673918, 0.7937548972837438, 0.0547662955766306,
  0.1898913335360824, 0.2270301601513696, 0.7538026320596426, 0.2321431538672077, 0.8131411279299918,
  0.5762326087646179, 0.0138999522499136, 0.7544229486066271, 0.5813649103422158, 0.7523209552413872,
  0.1270008631055405, 0.5815908261436757, 0.0795110181262882, 0.0960317396466319, 0.6834384958400883,
  0.0424029513622274, 0.6496332894910619, 0.0794151896322587, 0.8450412053172489, 0.9282069362790097,
  0.0891213585226762, 0.7121663452683522, 0.8605955228254681, 0.8162880814179527, 0.6840710209962468,
  0.8885168566247246, 0.2648583723484166, 0.2378118766236547, 0.2194598517605923, 0.4952133061958317,
  0.7669134748716009, 0.9169738665941634, 0.8281631446062202, 0.6183810983540459, 0.5246702191009984,
  0.7090134237061794, 0.8529736891165158, 0.7853797483087765, 0.1818164909228406, 0.0489857099291994
]

let n = numbers.slice()
let a = addresses.slice()

// We need pseudo-random, yet predicatable randomness for consistent coverage reports.
export function random() {
  if (!n.length) n = numbers.slice()

  return n.pop()!
}

export function randomAddresses(n = 1) {
  if (n > a.length) a = addresses.slice()
  return a.splice(0, n)
}

export function randomAddress() {
  return randomAddresses()[0]
}
