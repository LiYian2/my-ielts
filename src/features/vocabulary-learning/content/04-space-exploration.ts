import type { EntryId, Lesson, PassageParagraph, TopicContent, WordCard } from '../types'

interface CardSpec {
  word: string
  ipa: string
  meaning: string
  collocations: [string, string] | [string, string, string]
  example: string
  use: 'speaking' | 'writing' | 'both'
  prompt: string
  priority?: 'high'
}

interface SentenceSpec {
  word: string
  sentence: string
}

interface TaskSpec {
  id: string
  mode: 'collocation' | 'rewrite' | 'sentence' | 'speaking'
  prompt: string
  required: string[]
  reference: string
}

interface LessonBlueprint {
  id: string
  title: string
  warmup: string
  translation: string[]
  groups: SentenceSpec[][]
  tasks: TaskSpec[]
}

const topicPrefix = '04-space-exploration:'

function id(word: string): EntryId {
  return `${topicPrefix}${word}` as EntryId
}

function annotatedSentence(spec: SentenceSpec, prefix = '') {
  const target = spec.word
  const targetIndex = spec.sentence.toLowerCase().indexOf(target.toLowerCase())
  if (targetIndex < 0)
    throw new Error(`Passage sentence does not contain ${target}: ${spec.sentence}`)

  const before = spec.sentence.slice(0, targetIndex)
  const matched = spec.sentence.slice(targetIndex, targetIndex + target.length)
  const after = spec.sentence.slice(targetIndex + target.length)
  return [
    { text: `${prefix}${before}` },
    { text: matched, entryId: id(spec.word) },
    { text: after },
  ]
}

function paragraphs(groups: SentenceSpec[][]): PassageParagraph[] {
  return groups.map(group => ({
    segments: group.flatMap((spec, index) => annotatedSentence(spec, index ? ' ' : '')),
  }))
}

const cards: CardSpec[] = [
  { word: 'galaxy', ipa: '/ɡˈælɐksˌi/', meaning: '星系', collocations: ['a distant galaxy', 'map a galaxy'], example: 'A new telescope can map a distant galaxy in remarkable detail.', use: 'both', prompt: 'Describe a discovery involving a galaxy.', priority: 'high' },
  { word: 'cosmos', ipa: '/kˈɒzmɒs/', meaning: '宇宙', collocations: ['the known cosmos', 'explore the cosmos'], example: 'Space research helps us place Earth within the known cosmos.', use: 'writing', prompt: 'Explain why people want to explore the cosmos.', priority: 'high' },
  { word: 'universe', ipa: '/jˈuːnɪvˌɜːs/', meaning: '宇宙；万物', collocations: ['the observable universe', 'the origin of the universe'], example: 'The observable universe is far larger than any single mission can study.', use: 'both', prompt: 'Use universe to make a careful scientific claim.', priority: 'high' },
  { word: 'interstellar', ipa: '/ˌɪntəstˈɛlɐ/', meaning: '星际的', collocations: ['interstellar space', 'interstellar dust'], example: 'Interstellar dust can hide young stars from ordinary cameras.', use: 'writing', prompt: 'Contrast interstellar space with space near Earth.' },
  { word: 'terrestrial', ipa: '/təɹˈɛstɹɪəl/', meaning: '地球的；陆地的', collocations: ['terrestrial life', 'terrestrial observation'], example: 'Terrestrial observatories still provide valuable evidence.', use: 'writing', prompt: 'Compare terrestrial and space-based observation.' },
  { word: 'celestial', ipa: '/səlˈɛstjəl/', meaning: '天体的；天空的', collocations: ['celestial body', 'celestial event'], example: 'The eclipse was a celestial event that drew families outdoors.', use: 'both', prompt: 'Describe a memorable celestial event.' },
  { word: 'astronomy', ipa: '/ɐstɹˈɒnəmi/', meaning: '天文学', collocations: ['study astronomy', 'modern astronomy'], example: 'Modern astronomy depends on patient observation and transparent data.', use: 'both', prompt: 'Say how astronomy benefits society.', priority: 'high' },
  { word: 'astrology', ipa: '/ɐstɹˈɒlədʒi/', meaning: '占星术；占星学', collocations: ['believe in astrology', 'astrology column'], example: 'Astronomy tests evidence, whereas astrology does not follow the same scientific method.', use: 'both', prompt: 'Distinguish astronomy from astrology politely.' },
  { word: 'astronaut', ipa: '/ˈæstɹənˌɔːt/', meaning: '宇航员', collocations: ['train an astronaut', 'an astronaut aboard a spacecraft'], example: 'Every astronaut trains for routine work as well as emergencies.', use: 'both', prompt: 'Describe skills an astronaut needs.', priority: 'high' },
  { word: 'comet', ipa: '/kˈɒmɪt/', meaning: '彗星', collocations: ['a comet passes by', 'a comet’s tail'], example: 'The comet became visible shortly after sunset.', use: 'speaking', prompt: 'Describe what you would do if a comet were visible.' },
  { word: 'meteorite', ipa: '/mˈiːtɪˌɔːɹaɪt/', meaning: '陨石', collocations: ['a meteorite sample', 'recover a meteorite'], example: 'Researchers recovered a meteorite sample from a dry desert.', use: 'writing', prompt: 'Explain why a meteorite sample is valuable.' },
  { word: 'crater', ipa: '/kɹˈeɪtɐ/', meaning: '撞击坑；火山口', collocations: ['an impact crater', 'the rim of a crater'], example: 'The rover photographed the rim of a crater before dawn.', use: 'both', prompt: 'Use crater in a description of a landscape.' },
  { word: 'dust', ipa: '/dˈʌst/', meaning: '尘埃', collocations: ['cosmic dust', 'a cloud of dust'], example: 'Cosmic dust can interfere with a camera lens.', use: 'writing', prompt: 'Explain one difficulty caused by dust.' },
  { word: 'ash', ipa: '/ˈæʃ/', meaning: '灰烬；火山灰', collocations: ['volcanic ash', 'an ash cloud'], example: 'Volcanic ash would make a landing site much harder to assess.', use: 'writing', prompt: 'Describe how ash could affect a mission.' },
  { word: 'envelope', ipa: '/ˈenvələʊp/', meaning: '外层；包层', collocations: ['a gaseous envelope', 'the outer envelope'], example: 'The probe measured the planet’s thin gaseous envelope.', use: 'writing', prompt: 'Describe an outer envelope around a planet.' },
  { word: 'chunk', ipa: '/tʃˈʌŋk/', meaning: '厚块；大块', collocations: ['a chunk of ice', 'a large chunk'], example: 'A large chunk of ice drifted past the camera.', use: 'speaking', prompt: 'Describe a chunk of material seen in space.' },
  { word: 'spacecraft', ipa: '/spˈeɪskɹɑːft/', meaning: '航天器；宇宙飞船', collocations: ['launch a spacecraft', 'an unmanned spacecraft'], example: 'The unmanned spacecraft sent images back to Earth.', use: 'both', prompt: 'Describe a spacecraft mission.' },
  { word: 'spaceship', ipa: '/spˈeɪsʃɪp/', meaning: '宇宙飞船', collocations: ['board a spaceship', 'a crewed spaceship'], example: 'In fiction, a crewed spaceship often travels faster than current technology allows.', use: 'speaking', prompt: 'Compare a fictional spaceship with a real spacecraft.' },
  { word: 'probe', ipa: '/pɹˈəʊb/', meaning: '太空探测器；探测', collocations: ['a space probe', 'send a probe'], example: 'The agency sent a probe to examine the asteroid safely.', use: 'both', prompt: 'Recommend a destination for a probe.' },
  { word: 'module', ipa: '/mˈɒdjuːl/', meaning: '舱；模块', collocations: ['a landing module', 'a research module'], example: 'The landing module separated from the main vehicle on schedule.', use: 'writing', prompt: 'Explain the purpose of a module in a mission.' },
  { word: 'propulsion', ipa: '/pɹəpˈʌlʃən/', meaning: '推进力；推进系统', collocations: ['rocket propulsion', 'a propulsion system'], example: 'Engineers tested a propulsion system that uses less fuel.', use: 'writing', prompt: 'Explain why efficient propulsion matters.' },
  { word: 'pressure', ipa: '/pɹˈɛʃɐ/', meaning: '压力；压强', collocations: ['atmospheric pressure', 'withstand pressure'], example: 'The cabin must withstand extreme pressure differences.', use: 'both', prompt: 'Describe one kind of pressure in space travel.' },
  { word: 'dynamics', ipa: '/daɪnˈæmɪks/', meaning: '动力学；动态', collocations: ['orbital dynamics', 'the dynamics of'], example: 'Orbital dynamics determine when a satellite needs a small adjustment.', use: 'writing', prompt: 'Use dynamics to explain a changing system.' },
  { word: 'motion', ipa: '/mˈəʊʃən/', meaning: '运动；移动', collocations: ['in motion', 'circular motion'], example: 'In orbit, continuous motion prevents the spacecraft from falling straight down.', use: 'both', prompt: 'Explain circular motion in simple language.' },
  { word: 'vent', ipa: '/vˈɛnt/', meaning: '排气口；排放', collocations: ['a gas vent', 'vent excess heat'], example: 'A gas vent released vapour from beneath the icy surface.', use: 'writing', prompt: 'Describe what might emerge from a vent.' },
  { word: 'tail', ipa: '/tˈeɪl/', meaning: '尾部；尾迹', collocations: ['a comet’s tail', 'a bright tail'], example: 'Solar radiation pushed the comet’s tail away from the Sun.', use: 'both', prompt: 'Describe the direction of a comet’s tail.' },
  { word: 'curve', ipa: '/kˈɜːv/', meaning: '曲线；弧线', collocations: ['a gentle curve', 'follow a curve'], example: 'The planned route follows a gentle curve around the Moon.', use: 'writing', prompt: 'Describe a route that follows a curve.' },
  { word: 'exploration', ipa: '/ɛksplɔːɹˈeɪʃən/', meaning: '探索；勘探', collocations: ['space exploration', 'the exploration of'], example: 'Space exploration can inspire students to solve difficult problems.', use: 'both', prompt: 'Give one reason to support space exploration.' },
  { word: 'expedition', ipa: '/ˌɛkspədˈɪʃən/', meaning: '探险；远征队', collocations: ['mount an expedition', 'a scientific expedition'], example: 'The scientific expedition included engineers, doctors, and geologists.', use: 'both', prompt: 'Describe how you would prepare an expedition.' },
  { word: 'flyby', ipa: '/flˈaɪbaɪ/', meaning: '飞掠', collocations: ['a close flyby', 'conduct a flyby'], example: 'During a close flyby, the probe collected images for only a few minutes.', use: 'writing', prompt: 'Explain the advantage of a flyby.' },
  { word: 'observatory', ipa: '/ɒbzˈɜːvətəɹˌi/', meaning: '天文台', collocations: ['a ground-based observatory', 'an orbital observatory'], example: 'The observatory shared its images freely with schools.', use: 'both', prompt: 'Describe an observatory you would like to visit.' },
  { word: 'telescope', ipa: '/tˈɛlɪskˌəʊp/', meaning: '望远镜', collocations: ['a powerful telescope', 'observe through a telescope'], example: 'A powerful telescope can detect faint light from distant objects.', use: 'both', prompt: 'Explain what a telescope allows scientists to do.' },
  { word: 'spectacle', ipa: '/spˈɛktəkəl/', meaning: '壮观景象；奇观', collocations: ['an astronomical spectacle', 'a natural spectacle'], example: 'The eclipse was a spectacle, but the researchers also treated it as data.', use: 'both', prompt: 'Describe a natural spectacle without exaggerating.' },
  { word: 'orbit', ipa: '/ˈɔːbɪt/', meaning: '轨道；绕行', collocations: ['enter orbit', 'a stable orbit'], example: 'The satellite entered a stable orbit after its engines fired.', use: 'both', prompt: 'Explain why an orbit must be stable.' },
  { word: 'ecliptic', ipa: '/ɪklˈɪptɪk/', meaning: '黄道', collocations: ['the plane of the ecliptic', 'along the ecliptic'], example: 'Most planets appear close to the ecliptic when viewed from Earth.', use: 'writing', prompt: 'Use ecliptic in a precise astronomy sentence.' },
  { word: 'diameter', ipa: '/daɪˈæmɪtɐ/', meaning: '直径', collocations: ['measure the diameter', 'a diameter of'], example: 'The asteroid has a diameter of only a few hundred metres.', use: 'writing', prompt: 'Report a diameter clearly with a unit.' },
  { word: 'radius', ipa: '/ɹˈeɪdɪəs/', meaning: '半径', collocations: ['within a radius of', 'orbital radius'], example: 'The team surveyed rocks within a radius of two kilometres.', use: 'writing', prompt: 'Use radius to define a search area.' },
  { word: 'substance', ipa: '/sˈʌbstəns/', meaning: '物质；实质', collocations: ['a chemical substance', 'the substance of'], example: 'Water is the substance most researchers hope to find beneath the surface.', use: 'writing', prompt: 'Name a substance that matters in a mission.' },
  { word: 'composition', ipa: '/kˌɒmpəzˈɪʃən/', meaning: '成分；组成', collocations: ['chemical composition', 'analyse the composition'], example: 'The sample’s chemical composition suggested that it formed in cold conditions.', use: 'writing', prompt: 'Explain what composition can reveal.' },
  { word: 'compound', ipa: '/ˈkɒmpaʊnd/', meaning: '化合物；混合物', collocations: ['an organic compound', 'a chemical compound'], example: 'The instrument identified an organic compound in the soil.', use: 'writing', prompt: 'Use compound in a scientific finding.' },
  { word: 'fossil', ipa: '/fˈɒsəl/', meaning: '化石', collocations: ['fossil evidence', 'a fossil record'], example: 'Fossil evidence on Earth helps scientists ask better questions about Mars.', use: 'writing', prompt: 'Explain how a fossil record can inform exploration.' },
  { word: 'sample', ipa: '/sˈɑːmpəl/', meaning: '样品；样本', collocations: ['collect a sample', 'a soil sample'], example: 'The rover sealed each soil sample to avoid contamination.', use: 'both', prompt: 'Describe how to collect a reliable sample.' },
  { word: 'specimen', ipa: '/spˈɛsɪmən/', meaning: '标本；样本', collocations: ['a geological specimen', 'preserve a specimen'], example: 'A geological specimen can be studied repeatedly in a laboratory.', use: 'writing', prompt: 'Distinguish a specimen from a general sample.' },
  { word: 'particle', ipa: '/pˈɑːtɪkəl/', meaning: '颗粒；微粒', collocations: ['a charged particle', 'tiny particles'], example: 'Charged particles from the Sun can damage sensitive equipment.', use: 'writing', prompt: 'Explain how particles can create a risk.' },
  { word: 'molecule', ipa: '/mˈɒlɪkjˌuːl/', meaning: '分子', collocations: ['a water molecule', 'detect molecules'], example: 'The sensor was designed to detect water molecules in the air.', use: 'writing', prompt: 'Use molecule in a sentence about evidence.' },
  { word: 'atom', ipa: '/ˈætəm/', meaning: '原子', collocations: ['an atom of', 'atomic structure'], example: 'An atom is far too small to be seen with an ordinary telescope.', use: 'writing', prompt: 'Explain atom for a non-specialist reader.' },
  { word: 'ion', ipa: '/ˈaɪɒn/', meaning: '离子', collocations: ['a charged ion', 'ionised gas'], example: 'A charged ion can be guided by magnetic fields.', use: 'writing', prompt: 'Use ion in a description of a measurement.' },
  { word: 'electron', ipa: '/ɪlˈɛktɹɒn/', meaning: '电子', collocations: ['an electron beam', 'free electrons'], example: 'Free electrons created noise in the detector during the storm.', use: 'writing', prompt: 'Describe an effect involving electrons.' },
  { word: 'quantum', ipa: '/kwˈɒntəm/', meaning: '量子', collocations: ['quantum physics', 'a quantum effect'], example: 'Quantum physics may improve the precision of future sensors.', use: 'writing', prompt: 'Make a cautious claim using quantum.' },
  { word: 'liquid', ipa: '/lˈɪkwɪd/', meaning: '液体；液态的', collocations: ['liquid water', 'remain liquid'], example: 'Liquid water would be especially significant because it supports many chemical processes.', use: 'both', prompt: 'Explain why liquid water matters.' },
  { word: 'fluid', ipa: '/flˈuːɪd/', meaning: '流体；液体', collocations: ['a working fluid', 'fluid flow'], example: 'The engineers monitored fluid flow inside the cooling system.', use: 'writing', prompt: 'Describe fluid flow in a technical system.' },
  { word: 'solid', ipa: '/sˈɒlɪd/', meaning: '固体；固态的', collocations: ['a solid surface', 'solid evidence'], example: 'The lander needed solid evidence that the surface could support its weight.', use: 'both', prompt: 'Use solid in a scientific argument.' },
  { word: 'synthesise', ipa: '/sˈɪnθəsˌaɪz/', meaning: '合成；综合', collocations: ['synthesise evidence', 'synthesise a compound'], example: 'Students should synthesise evidence from several reliable sources.', use: 'writing', prompt: 'Use synthesise to connect two pieces of evidence.' },
  { word: 'formation', ipa: '/fɔːmˈeɪʃən/', meaning: '形成；构成', collocations: ['planet formation', 'the formation of'], example: 'The data may clarify the formation of small planets.', use: 'writing', prompt: 'Describe a process of formation.' },
  { word: 'method', ipa: '/mˈɛθəd/', meaning: '方法', collocations: ['a reliable method', 'research method'], example: 'A reliable method allows other teams to repeat the result.', use: 'both', prompt: 'Recommend a method for checking a claim.' },
  { word: 'spectrum', ipa: '/spˈɛktɹəm/', meaning: '光谱；范围', collocations: ['an emission spectrum', 'across the spectrum'], example: 'An emission spectrum can reveal gases that cannot be seen directly.', use: 'writing', prompt: 'Explain what a spectrum can reveal.' },
  { word: 'dimension', ipa: '/daɪmˈɛnʃən/', meaning: '维度；尺寸', collocations: ['a new dimension', 'three dimensions'], example: 'The simulation added a time dimension to a simple map.', use: 'writing', prompt: 'Describe a problem with more than one dimension.' },
  { word: 'frequency', ipa: '/fɹˈiːkwənsi/', meaning: '频率', collocations: ['signal frequency', 'at a frequency of'], example: 'The receiver listened at a frequency chosen to reduce interference.', use: 'writing', prompt: 'Report a frequency and its purpose.' },
  { word: 'signal', ipa: '/sˈɪɡnəl/', meaning: '信号', collocations: ['a weak signal', 'send a signal'], example: 'A weak signal reached Earth after travelling for hours.', use: 'both', prompt: 'Describe how a signal could be delayed.' },
  { word: 'antenna', ipa: '/ænˈtenə/', meaning: '天线', collocations: ['a radio antenna', 'deploy an antenna'], example: 'The spacecraft deployed its antenna once it cleared the atmosphere.', use: 'both', prompt: 'Explain why an antenna is essential.' },
  { word: 'circuit', ipa: '/sˈɜːkɪt/', meaning: '电路；线路', collocations: ['an electrical circuit', 'complete a circuit'], example: 'A damaged circuit prevented one camera from sending data.', use: 'writing', prompt: 'Describe a fault in a circuit.' },
  { word: 'refraction', ipa: '/ɹɪfɹˈækʃən/', meaning: '折射', collocations: ['atmospheric refraction', 'light refraction'], example: 'Atmospheric refraction can make a star appear slightly higher than it is.', use: 'writing', prompt: 'Explain one observation affected by refraction.' },
  { word: 'ultraviolet', ipa: '/ˌʊltɹɐvˈaɪələt/', meaning: '紫外线的；紫外辐射', collocations: ['ultraviolet radiation', 'ultraviolet light'], example: 'Ultraviolet radiation is invisible, so instruments must measure it.', use: 'writing', prompt: 'Describe an invisible kind of radiation.' },
  { word: 'radioactive', ipa: '/ɹˌeɪdɪəʊˈæktɪv/', meaning: '放射性的', collocations: ['radioactive material', 'radioactive decay'], example: 'The team stored radioactive material behind protective shielding.', use: 'writing', prompt: 'Explain a safety measure for radioactive material.' },
  { word: 'distinct', ipa: '/dɪstˈɪŋkt/', meaning: '明显不同的；清晰的', collocations: ['a distinct pattern', 'distinct from'], example: 'The researchers found a distinct pattern in the temperature data.', use: 'both', prompt: 'Compare two distinct patterns.' },
  { word: 'discernible', ipa: '/dɪsˈɜːnəbəl/', meaning: '可辨别的', collocations: ['barely discernible', 'discernible difference'], example: 'At first, the difference was barely discernible to the human eye.', use: 'writing', prompt: 'Describe a change that is barely discernible.' },
  { word: 'invisible', ipa: '/ɪnvˈɪzəbəl/', meaning: '看不见的', collocations: ['invisible to the eye', 'an invisible force'], example: 'Much of the radiation is invisible to the naked eye.', use: 'both', prompt: 'Explain how something invisible can be measured.' },
  { word: 'collision', ipa: '/kəlˈɪʒən/', meaning: '碰撞', collocations: ['avoid a collision', 'a collision risk'], example: 'Controllers changed the route to avoid a collision with debris.', use: 'both', prompt: 'Explain how a collision risk can be reduced.' },
  { word: 'squash', ipa: '/skwˈɒʃ/', meaning: '压扁；挤压', collocations: ['squash a container', 'be squashed by'], example: 'Without careful packing, a fragile container could be squashed during launch.', use: 'speaking', prompt: 'Describe how to protect an item from being squashed.' },
  { word: 'fragment', ipa: '/ˈfræɡmənt/', meaning: '碎片；片段', collocations: ['a rock fragment', 'a fragment of'], example: 'A rock fragment was collected from the edge of the landing site.', use: 'writing', prompt: 'Describe what a fragment can tell scientists.' },
  { word: 'cataclysmic', ipa: '/kˌætɐklˈɪsmɪk/', meaning: '剧变的；灾难性的', collocations: ['a cataclysmic event', 'cataclysmic change'], example: 'A cataclysmic event may have reshaped the planet long ago.', use: 'writing', prompt: 'Use cataclysmic for a major historical change.' },
  { word: 'overwhelming', ipa: '/ˌəʊvəwˈɛlmɪŋ/', meaning: '压倒性的；难以承受的', collocations: ['overwhelming evidence', 'an overwhelming task'], example: 'The evidence was not overwhelming, so the team avoided a dramatic conclusion.', use: 'both', prompt: 'Use overwhelming to evaluate evidence carefully.' },
  { word: 'despair', ipa: '/dɪspˈeə/', meaning: '绝望', collocations: ['in despair', 'feel despair'], example: 'The failed transmission caused concern, not despair, because a backup system existed.', use: 'speaking', prompt: 'Describe how a team can avoid despair after a setback.' },
  { word: 'desperate', ipa: '/dˈɛspəɹət/', meaning: '极需要的；绝望的', collocations: ['desperate for', 'a desperate attempt'], example: 'A desperate attempt to save fuel would have created new risks.', use: 'writing', prompt: 'Explain why a desperate attempt may be unwise.' },
  { word: 'hopeless', ipa: '/hˈəʊpləs/', meaning: '无望的', collocations: ['seem hopeless', 'a hopeless case'], example: 'The problem seemed hopeless until the team found an alternative route.', use: 'both', prompt: 'Describe a situation that only seemed hopeless.' },
]

const lessonBlueprints: LessonBlueprint[] = [
  {
    id: 'a-wider-sky',
    title: 'A wider sky',
    warmup: 'Which question about space would you most like scientists to answer, and why?',
    translation: [
      '我们的星系只是更广阔宇宙中由恒星组成的一个群体。对学生而言，把宇宙的尺度与真实观测联系起来，宇宙就不再那么抽象。没有一次任务能解释整个宇宙，但每一项谨慎的测量都能缩小一个问题的范围。',
      '星际尘埃会遮挡新生恒星，而地球上的仪器可提供有用的比较。即使卫星在大气层上方收集数据，地面天文台仍然不可或缺。罕见的天体现象能让一堂学校课程成为公众共同的体验。',
      '天文学提出可检验的问题，而占星术提供的是信念，并非科学证据。负责任的讲解者可以尊重地讨论占星术，但不把它与天文学混为一谈。宇航员必须在常规实验意外变化时作出冷静决定。',
      '如果天空晴朗，今年冬天一颗彗星可能会在日落后不久出现。在地球上发现的陨石能保存来自行星之外物质的线索。月球撞击坑的边缘显示，一次小型撞击也能多么剧烈地重塑地貌。',
      '细小尘埃会落在太阳能板上，使探测车的工作更困难。相较之下，地球上的火山灰帮助工程师为艰难的着陆条件作演练。行星稀薄的气体外层会改变阳光到达其表面的方式。',
    ],
    groups: [
      [{ word: 'galaxy', sentence: 'Our galaxy is only one community of stars in a much larger cosmos.' }, { word: 'cosmos', sentence: 'For students, the cosmos becomes less abstract when its scale is linked to real observations.' }, { word: 'universe', sentence: 'No single mission can explain the whole universe, but each careful measurement narrows a question.' }],
      [{ word: 'interstellar', sentence: 'Interstellar dust can hide new stars, while terrestrial instruments offer a useful comparison.' }, { word: 'terrestrial', sentence: 'Terrestrial observatories remain essential even when satellites collect data above the atmosphere.' }, { word: 'celestial', sentence: 'A rare celestial event can turn a school lesson into a shared public experience.' }],
      [{ word: 'astronomy', sentence: 'Astronomy asks testable questions, whereas astrology offers beliefs rather than scientific evidence.' }, { word: 'astrology', sentence: 'A responsible presenter can discuss astrology respectfully without confusing it with astronomy.' }, { word: 'astronaut', sentence: 'An astronaut must make calm decisions when a routine experiment changes unexpectedly.' }],
      [{ word: 'comet', sentence: 'This winter, a comet may be visible just after sunset if the sky is clear.' }, { word: 'meteorite', sentence: 'A meteorite found on Earth can preserve clues about material from beyond our planet.' }, { word: 'crater', sentence: 'The rim of a lunar crater shows how violently a small impact can reshape a landscape.' }],
      [{ word: 'dust', sentence: 'Fine dust makes a rover’s work harder because it can settle on solar panels.' }, { word: 'ash', sentence: 'By contrast, volcanic ash on Earth helps engineers practise for difficult landing conditions.' }, { word: 'envelope', sentence: 'The planet’s thin gaseous envelope changes how sunlight reaches its surface.' }],
    ],
    tasks: [
      { id: 'wider-sky-collocations', mode: 'collocation', prompt: 'Write one accurate sentence about observation; include both required words.', required: ['galaxy', 'terrestrial'], reference: 'A distant galaxy can be studied through terrestrial observation.' },
      { id: 'wider-sky-rewrite', mode: 'rewrite', prompt: 'Rewrite the claim in a cautious, evidence-based way and use both words.', required: ['astronomy', 'astrology'], reference: 'Astronomy relies on testable evidence, while astrology does not use the same scientific method.' },
      { id: 'wider-sky-personal-example', mode: 'sentence', prompt: 'Write a personal example: say what you would observe if a rare event appeared above your home.', required: ['comet', 'celestial'], reference: 'If a comet appeared above my home, I would watch the celestial event from a safe, dark place.' },
      { id: 'wider-sky-short-response', mode: 'speaking', prompt: 'Speak for 45 seconds: explain one skill an astronaut needs and why it matters.', required: ['astronaut', 'crater'], reference: 'An astronaut needs calm judgement because a landing near a crater may require an immediate change of plan.' },
    ],
  },
  {
    id: 'designing-a-mission',
    title: 'Designing a mission',
    warmup: 'Would you choose a crewed mission or an unmanned mission? Give one practical reason.',
    translation: [
      '研究另一个星系的任务始于仪器真正能够回答的、并不夸张的问题。探索宇宙也要求公众理解，为什么缓慢而谨慎的工作很重要。宇航员可以说明，一次任务是在增加证据，而不是解决宇宙中的每个谜团。',
      '天文学决定时间表，因为目标可能只在很短的窗口内可见。发射前，宇航员既要演练正常程序，也要演练紧急决策。目标附近一大块冰可能损坏暴露在外的仪器。',
      '这艘无人航天器在保护外壳下携带一个小型研究舱。与虚构的宇宙飞船不同，真实飞行器不能不消耗燃料就随意改变方向。任务控制中心可能先派出一个探测器，以降低未来载人任务的风险。',
      '着陆舱必须在恰好的时刻分离。高效推进系统让团队在路线需要改变时有更多选择。舱内气压受到持续监测，以保护乘员。',
      '轨道动力学决定接近目标的最安全时机。航天器会因惯性保持运动，而重力不断使其路径弯曲。地表的气体喷口可能揭示冰层下方的物质。',
    ],
    groups: [
      [{ word: 'galaxy', sentence: 'A mission to study another galaxy begins with a modest question that instruments can actually answer.' }, { word: 'cosmos', sentence: 'Exploring the cosmos also requires the public to understand why slow, careful work matters.' }, { word: 'universe', sentence: 'An astronaut can explain that one mission adds evidence rather than solving every mystery of the universe.' }],
      [{ word: 'astronomy', sentence: 'Astronomy guides the timetable, because a target may be visible only during a short window.' }, { word: 'astronaut', sentence: 'Before launch, the astronaut rehearses both normal procedures and emergency decisions.' }, { word: 'chunk', sentence: 'A large chunk of ice near the target could damage an exposed instrument.' }],
      [{ word: 'spacecraft', sentence: 'The unmanned spacecraft carries a small research module beneath its protective shell.' }, { word: 'spaceship', sentence: 'Unlike a fictional spaceship, the vehicle cannot simply change direction without using fuel.' }, { word: 'probe', sentence: 'Mission control may send a probe first to reduce the risks for a future crew.' }],
      [{ word: 'module', sentence: 'The landing module must separate at exactly the right moment.' }, { word: 'propulsion', sentence: 'Efficient propulsion gives the team more options if the route needs to change.' }, { word: 'pressure', sentence: 'Inside the cabin, pressure is monitored continuously to protect the crew.' }],
      [{ word: 'dynamics', sentence: 'Orbital dynamics determine the safest time to approach the target.' }, { word: 'motion', sentence: 'Because of inertia, the spacecraft remains in motion while gravity continually bends its path.' }, { word: 'vent', sentence: 'A gas vent on the surface might reveal material from beneath the ice.' }],
    ],
    tasks: [
      { id: 'mission-design-collocations', mode: 'collocation', prompt: 'Write one practical sentence that combines the collocations efficient propulsion and reliable pressure control.', required: ['spacecraft', 'propulsion', 'pressure'], reference: 'The spacecraft needs efficient propulsion and reliable pressure control before it can carry a crew.' },
      { id: 'mission-design-rewrite', mode: 'rewrite', prompt: 'Turn the fictional claim into a realistic one, using the two required words.', required: ['spaceship', 'motion'], reference: 'A real spaceship can change its motion by using propulsion or by planning a gravity assist.' },
      { id: 'mission-design-personal-example', mode: 'sentence', prompt: 'Write a personal example: choose one system you would test before launch and explain why.', required: ['module', 'pressure'], reference: 'Before launch, I would test the landing module’s pressure controls because the crew cannot repair every fault in flight.' },
      { id: 'mission-design-short-response', mode: 'speaking', prompt: 'Speak for 45 seconds: argue for either a crewed mission or a probe.', required: ['probe', 'dynamics'], reference: 'I would send a probe first because orbital dynamics can be tested without exposing a crew to unnecessary risk.' },
    ],
  },
  {
    id: 'reading-a-planet',
    title: 'Reading a planet',
    warmup: 'What evidence would convince you that a distant world is worth exploring?',
    translation: [
      '当探险队开始观测时，彗星的尾部指向远离太阳的方向。探测器沿着平缓的曲线飞行，使相机朝向行星明亮的一侧。这种探索很有价值，因为它检验了一个明确的科学问题。',
      '这次探险既有地球上的团队参与，也有人员远程操作仪器。在飞掠期间，探测器只有几分钟来收集最详细的图像。当天文台追踪探测器时，它已经微弱到公众看不见了。',
      '通过望远镜，研究人员观察到一个引人注目的奇观，但测量数据比图像本身更重要。对科学家而言，只有能与过去观测相比较时，这个奇观才有用。飞掠之后，飞行器进入一条轨道，以使仪器保持在阳光下。',
      '团队在说明行星在天空中的位置时，把黄道作为参照。更清晰的图像揭示出边缘后，其直径被修订了。随后，着陆区周围的安全搜索半径被缩小。',
      '关键物质是冰冻的水，它可能在阴影区域保持稳定。它的化学成分表明那里曾长期处于寒冷条件。一种有机化合物被检测到，但结果仍需独立核查。',
    ],
    groups: [
      [{ word: 'tail', sentence: 'A comet’s tail pointed away from the Sun as the expedition began its observations.' }, { word: 'curve', sentence: 'The probe followed a gentle curve so that its cameras faced the bright side of the planet.' }, { word: 'exploration', sentence: 'This kind of exploration is valuable because it tests a clear scientific question.' }],
      [{ word: 'expedition', sentence: 'The expedition involved teams on Earth as well as people operating the instruments remotely.' }, { word: 'flyby', sentence: 'During the flyby, the probe had only minutes to collect its most detailed images.' }, { word: 'observatory', sentence: 'A ground-based observatory tracked the probe long after it became too faint for the public to see.' }],
      [{ word: 'telescope', sentence: 'Through the telescope, researchers observed a striking spectacle, but the measurements mattered more than the image.' }, { word: 'spectacle', sentence: 'For the scientists, the spectacle was useful only when it could be compared with previous observations.' }, { word: 'orbit', sentence: 'After the flyby, the craft entered an orbit designed to keep its instruments in sunlight.' }],
      [{ word: 'ecliptic', sentence: 'The team used the ecliptic as a reference when explaining the planet’s position in the sky.' }, { word: 'diameter', sentence: 'Its diameter was revised after sharper images revealed the edge more clearly.' }, { word: 'radius', sentence: 'The safe search radius around the landing zone was then reduced.' }],
      [{ word: 'substance', sentence: 'The key substance was frozen water, which could remain stable in shaded regions.' }, { word: 'composition', sentence: 'Its chemical composition suggested a long history of cold conditions.' }, { word: 'compound', sentence: 'One organic compound was detected, although the result needed independent checks.' }],
    ],
    tasks: [
      { id: 'planet-reading-collocations', mode: 'collocation', prompt: 'Write a factual observation using both required words and one number.', required: ['diameter', 'radius'], reference: 'The asteroid has a diameter of 600 metres, so the team set a safety radius of two kilometres.' },
      { id: 'planet-reading-rewrite', mode: 'rewrite', prompt: 'Rewrite an overconfident headline as a cautious finding from a flyby.', required: ['flyby', 'compound', 'composition'], reference: 'During the flyby, the probe found an organic compound, but its composition needs further analysis.' },
      { id: 'planet-reading-personal-example', mode: 'sentence', prompt: 'Write a personal example: say what you would look for through an observatory.', required: ['observatory', 'telescope'], reference: 'At an observatory, I would use a telescope to compare a comet’s tail with earlier images.' },
      { id: 'planet-reading-short-response', mode: 'speaking', prompt: 'Speak for 45 seconds: explain why a flyby can still be useful.', required: ['flyby', 'orbit', 'spectacle'], reference: 'A flyby may be brief, but it can help scientists plan a later orbit and turn a striking spectacle into useful measurements.' },
    ],
  },
  {
    id: 'from-material-to-evidence',
    title: 'From material to evidence',
    warmup: 'Why should scientists be cautious before announcing that they have found life?',
    translation: [
      '地球上的化石记录告诉研究人员，不寻常的形状并不自动意味着生命迹象。每个样品必须密封，以免地球物质污染它。保存完好的标本让另一间实验室日后也能检验同一项主张。',
      '带电粒子会损坏传感器，或在数据中制造误导性的噪声。发现一个水分子会很重要，但它本身并不能证明存在生命。在原子尺度上，仪器是推断结构，而不是简单拍照。',
      '带电离子可以通过电场与中性气体分离。自由电子会在太阳风暴期间改变测量结果。量子效应可能提高传感器精度，但不能免除谨慎解释的需要。',
      '当研究人员考虑可能的栖息地时，液态水比冰是更有力的线索。冷却液必须可靠地在仪器中循环。与松散尘埃相比，坚实表面为着陆器提供更安全的工作地点。',
      '科学家并不挑选一个令人兴奋的结果，而是综合许多测量所得的证据。这种方法能阐明行星的形成和大气层的历史。透明的方法让其他团队能够质疑或证实结论。',
    ],
    groups: [
      [{ word: 'fossil', sentence: 'A fossil record on Earth teaches researchers that unusual shapes are not automatically signs of life.' }, { word: 'sample', sentence: 'Each sample must be sealed so that material from Earth does not contaminate it.' }, { word: 'specimen', sentence: 'A well-preserved specimen lets another laboratory test the same claim later.' }],
      [{ word: 'particle', sentence: 'A charged particle can damage a sensor or create misleading noise in the data.' }, { word: 'molecule', sentence: 'Finding a water molecule would be important, but it would not by itself prove life.' }, { word: 'atom', sentence: 'At the level of an atom, instruments infer structure rather than simply taking a photograph.' }],
      [{ word: 'ion', sentence: 'A charged ion may be separated from neutral gas by an electric field.' }, { word: 'electron', sentence: 'Free electrons can alter a measurement during a solar storm.' }, { word: 'quantum', sentence: 'A quantum effect may improve a sensor, yet it does not remove the need for careful interpretation.' }],
      [{ word: 'liquid', sentence: 'Liquid water is a stronger clue than ice when researchers consider possible habitats.' }, { word: 'fluid', sentence: 'The cooling fluid must circulate reliably through the instrument.' }, { word: 'solid', sentence: 'A solid surface gives the lander a safer place to work than loose dust does.' }],
      [{ word: 'synthesise', sentence: 'Rather than selecting one exciting result, scientists synthesise evidence from many measurements.' }, { word: 'formation', sentence: 'That method can clarify the formation of a planet and the history of its atmosphere.' }, { word: 'method', sentence: 'A transparent method allows other teams to challenge or confirm the conclusion.' }],
    ],
    tasks: [
      { id: 'evidence-collocations', mode: 'collocation', prompt: 'Write one sentence that combines the collocations collect samples and synthesise evidence.', required: ['sample', 'synthesise'], reference: 'Researchers should collect samples from more than one site and synthesise the evidence before drawing a conclusion.' },
      { id: 'evidence-rewrite', mode: 'rewrite', prompt: 'Rewrite “One water molecule proves there is liquid water” as a cautious scientific conclusion.', required: ['molecule', 'liquid', 'method'], reference: 'A water molecule is evidence of water, but not evidence that the water is liquid; a reliable method needs further checks.' },
      { id: 'evidence-personal-example', mode: 'sentence', prompt: 'Write a personal example: choose evidence you would collect before making a claim about life.', required: ['sample', 'specimen'], reference: 'Before making a claim about life, I would compare a sealed sample with a preserved specimen from a similar site.' },
      { id: 'evidence-short-response', mode: 'speaking', prompt: 'Speak for 45 seconds: explain why scientists should repeat a measurement.', required: ['particle', 'electron', 'method'], reference: 'A particle or free electron can create misleading noise, so a transparent method should produce evidence that another team can test.' },
    ],
  },
  {
    id: 'communicating-uncertainty',
    title: 'Communicating uncertainty',
    warmup: 'How can the public support space research without expecting instant, dramatic answers?',
    translation: [
      '发射光谱能显示相机无法直接看见的气体。加入时间这个维度，帮助团队解释为何结果在数周内变化。接收器在特定频率监听，以减少来自地球的干扰。航天器从行星背后出现后，一个微弱的信号终于到达地球。',
      '数据能否发送，取决于天线先精确指向地球。受损电路延迟了传输，但没有结束任务。大气折射能使远处物体看上去略有偏移。紫外辐射不可见，因此公众图像需要清晰说明。',
      '放射性物质被存放在屏蔽层后，以保护乘员。数据呈现出一个明显模式，但原因仍未确定。起初，即使有经验的观测者也几乎辨别不出差异。最重要的过程可能肉眼不可见，但能用合适工具测量。',
      '控制人员改变路线，以避免与一个小物体相撞。发射期间，包装不当可能会压坏货舱内脆弱的容器。着陆后收集的一块岩石碎片，仍可能揭示大量有关地形的信息。一场剧变性的撞击也许能解释为什么一个区域与另一个区域如此不同。',
      '证据是有希望的，而非压倒性的，因此报告避免了戏剧化语言。一次信号失败后，团队感到担心而非绝望，因为已有备用方案。拼命想节省时间的尝试可能造成更大的安全风险。直到工程师找到另一条电路路线前，这个问题似乎毫无希望。',
    ],
    groups: [
      [{ word: 'spectrum', sentence: 'An emission spectrum can show gases that no camera can see directly.' }, { word: 'dimension', sentence: 'Adding a time dimension helped the team explain why the result changed over several weeks.' }, { word: 'frequency', sentence: 'The receiver listened at a frequency chosen to reduce interference from Earth.' }, { word: 'signal', sentence: 'A weak signal finally arrived after the spacecraft emerged from behind the planet.' }],
      [{ word: 'antenna', sentence: 'The antenna had to point precisely at Earth before the data could be sent.' }, { word: 'circuit', sentence: 'A damaged circuit delayed the transmission but did not end the mission.' }, { word: 'refraction', sentence: 'Atmospheric refraction can make a distant object appear slightly displaced.' }, { word: 'ultraviolet', sentence: 'Ultraviolet radiation is invisible, so a public image needs a clear explanation.' }],
      [{ word: 'radioactive', sentence: 'Radioactive material was stored behind shielding to protect the crew.' }, { word: 'distinct', sentence: 'The data showed a distinct pattern, although the cause remained uncertain.' }, { word: 'discernible', sentence: 'At first, the difference was barely discernible even to experienced observers.' }, { word: 'invisible', sentence: 'The most important process may be invisible to the naked eye but measurable with the right tool.' }],
      [{ word: 'collision', sentence: 'Controllers changed the route to avoid a collision with a small object.' }, { word: 'squash', sentence: 'During launch, poor packing could squash a fragile container inside the cargo bay.' }, { word: 'fragment', sentence: 'A rock fragment collected after landing may still reveal a great deal about the terrain.' }, { word: 'cataclysmic', sentence: 'A cataclysmic impact could explain why one region looks so different from another.' }],
      [{ word: 'overwhelming', sentence: 'The evidence was promising rather than overwhelming, so the report avoided dramatic language.' }, { word: 'despair', sentence: 'After a failed signal, the team felt concern rather than despair because a backup plan existed.' }, { word: 'desperate', sentence: 'A desperate attempt to save time might have created a larger safety risk.' }, { word: 'hopeless', sentence: 'The problem seemed hopeless until engineers found an alternative circuit route.' }],
    ],
    tasks: [
      { id: 'uncertainty-collocations', mode: 'collocation', prompt: 'Write a careful update for the public about a delayed transmission.', required: ['signal', 'antenna', 'discernible'], reference: 'The antenna received a weak signal, but a discernible pattern suggests the spacecraft is still operating.' },
      { id: 'uncertainty-rewrite', mode: 'rewrite', prompt: 'Replace dramatic language with a balanced evidence statement.', required: ['overwhelming', 'distinct', 'invisible'], reference: 'The data show a distinct but invisible process; the evidence is not yet overwhelming.' },
      { id: 'uncertainty-personal-example', mode: 'sentence', prompt: 'Write a personal example: explain how you would protect an item during launch.', required: ['squash', 'fragment'], reference: 'I would secure each rock fragment in padded containers so that vibration could not squash it during launch.' },
      { id: 'uncertainty-short-response', mode: 'speaking', prompt: 'Speak for 45 seconds: give a calm update after an equipment fault.', required: ['circuit', 'hopeless', 'despair'], reference: 'A damaged circuit is serious, but the situation is not hopeless; the team should avoid despair and test the backup route.' },
    ],
  },
]

const sentenceByWord = new Map<string, string>()
lessonBlueprints.forEach((lesson) => {
  lesson.groups.flat().forEach((sentence) => {
    if (!sentenceByWord.has(sentence.word))
      sentenceByWord.set(sentence.word, sentence.sentence)
  })
})

function createLesson(blueprint: LessonBlueprint): Lesson {
  const sentenceSpecs = blueprint.groups.flat()
  const targetWords = [...new Set(sentenceSpecs.map(sentence => sentence.word))]
  return {
    id: blueprint.id,
    title: blueprint.title,
    warmupPrompt: blueprint.warmup,
    targetEntryIds: targetWords.map(id),
    passage: paragraphs(blueprint.groups),
    translation: blueprint.translation,
    recallExercises: sentenceSpecs.slice(0, 4).map((sentence) => {
      const wordIndex = sentence.sentence.toLowerCase().indexOf(sentence.word.toLowerCase())
      return {
        id: `${blueprint.id}-recall-${sentence.word}`,
        entryId: id(sentence.word),
        before: sentence.sentence.slice(0, wordIndex),
        after: sentence.sentence.slice(wordIndex + sentence.word.length),
        acceptedAnswers: [sentence.word],
        meaningCue: cards.find(card => card.word === sentence.word)?.meaning ?? '',
      }
    }),
    productionTasks: blueprint.tasks.map(task => ({
      id: task.id,
      mode: task.mode,
      prompt: task.prompt,
      requiredEntryIds: task.required.filter(word => cards.some(card => card.word === word)).map(id),
      referenceAnswer: task.reference,
      rubric: ['meaning', 'collocation', 'grammar', 'register', 'relevance'],
    })),
  }
}

const wordCards = Object.fromEntries(cards.map((card): [EntryId, WordCard] => {
  const passageSentence = sentenceByWord.get(card.word)
  if (!passageSentence)
    throw new Error(`No passage sentence for ${card.word}`)

  return [id(card.word), {
    entryId: id(card.word),
    priority: card.priority ?? 'standard',
    ipa: card.ipa,
    meaning: card.meaning,
    collocations: card.collocations,
    example: { text: card.example, use: card.use },
    passageSentence,
    outputPrompt: card.prompt,
    usageNotes: card.word === 'synthesise' ? ['Use the British spelling synthesise in prose; synthesize is the American variant.'] : undefined,
  }]
})) as Record<EntryId, WordCard>

const spaceExplorationContent = {
  schemaVersion: 1,
  topicId: '04-space-exploration',
  slug: 'space-exploration',
  title: '太空探索：从观测到论证',
  level: 'B2-C1',
  lessons: lessonBlueprints.map(createLesson),
  wordCards,
  finalSpeaking: {
    id: 'space-exploration-speaking',
    mode: 'speaking',
    prompt: 'IELTS Speaking Part 3: Should governments continue to invest in space exploration when there are urgent problems on Earth? Speak for about two minutes. Take a clear position, give a concrete example, and acknowledge one limitation.',
    requiredEntryIds: [id('spacecraft'), id('astronomy'), id('method')],
    referenceAnswer: 'Governments should continue to fund space exploration, provided that projects have clear goals and public accountability. A spacecraft can improve astronomy by gathering evidence that terrestrial instruments cannot obtain. However, each method should be judged against alternatives, especially when public funds are limited.',
    rubric: ['meaning', 'collocation', 'grammar', 'register', 'relevance'],
  },
  finalWriting: {
    id: 'space-exploration-writing',
    mode: 'writing',
    prompt: 'IELTS Task 2 paragraph: Some people believe that funding space programmes is a waste of money, while others argue that it brings essential benefits. Write one balanced body paragraph (90–120 words). Use a concession and then develop your main point with a precise example.',
    requiredEntryIds: [id('exploration'), id('synthesise'), id('signal'), id('terrestrial')],
    referenceAnswer: 'Although governments must fund urgent services on Earth, space exploration can produce evidence with clear terrestrial value. For example, scientists synthesise satellite data to monitor environmental change, while satellite signals support navigation and communications. These benefits do not mean that every mission deserves automatic funding: programmes should have transparent goals, realistic budgets, and independent evaluation. Nevertheless, treating all launches as a luxury ignores the methods, measurements, and skilled employment that missions create. Governments should therefore maintain carefully targeted investment in exploration, while ensuring that it complements rather than competes with essential public services.',
    rubric: ['meaning', 'collocation', 'grammar', 'register', 'relevance'],
  },
} satisfies TopicContent

export default spaceExplorationContent
