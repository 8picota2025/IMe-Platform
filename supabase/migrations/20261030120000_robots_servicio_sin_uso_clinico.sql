-- PadBot y Cruzr son robots de servicio. Quita de las fichas los usos
-- clínicos, diagnósticos o terapéuticos. No toca Zuowei.
-- La landing canónica sale del TypeScript; esta migración alinea el CMS
-- (productos, familia robots y la guía enlazada) antes del build.

UPDATE productos SET
  descripcion_corta_es = $ime_txt$Robot de recepción con pantalla corporal de 19 pulgadas, reconocimiento facial, interacción por voz, navegación por mapas y videollamada remota.$ime_txt$,
  descripcion_corta_en = $ime_txt$Reception robot with 19-inch body screen, face recognition, voice interaction, map navigation and remote video support.$ime_txt$,
  descripcion_larga_es = $ime_txt$PadBot X3 está diseñado para recepción, orientación y atención inicial en instituciones con flujo permanente de visitantes. Integra pantalla principal de 10.1 pulgadas, pantalla corporal de 19 pulgadas, conectividad 4G/WiFi, reconocimiento facial, Q&A personalizable y gestión de sueño con reproducción de videos o slogans para comunicación institucional.

El robot permite crear mapas, definir puntos de destino, puntos de carga, espera de ascensor, acceso, cambio de mapa, muros virtuales, zonas restringidas y limites de velocidad. Esta lógica de navegación lo hace útil para recepciones, hoteles y campus corporativos donde se requiere orientar personas, contestar preguntas frecuentes y escalar atención a un operador.

Desde la app PadBot se habilita video bidireccional o unidireccional: el administrador puede ver la escena, controlar movimiento y convertir texto en voz del robot. En modelos equipados, X3 puede incorporar impresora opcional, útil para turnos, comprobantes o información de visita cuando el flujo lo requiera.

Para proyectos en Colombia, Latinoamérica y España, esta categoría responde a búsquedas de robots de recepción, atención a visitantes y automatización de servicios en hoteles, universidades y edificios corporativos.$ime_txt$,
  descripcion_larga_en = $ime_txt$PadBot X3 is designed for reception, wayfinding and first-line assistance in institutions with constant visitor flow. It combines a 10.1-inch main screen, a 19-inch body screen, 4G/WiFi connectivity, face recognition, customizable Q&A and sleep-mode video or slogan playback for institutional communication.

The robot supports map creation, destination points, charging points, elevator waiting points, access-control points, map switching points, virtual walls, restricted areas and speed-limit areas. This navigation logic makes it suitable for reception areas, hotels and corporate campuses that need to guide people, answer FAQs and escalate assistance to a remote operator.

The PadBot app enables two-way or one-way video: an administrator can see the on-site scene, control movement and convert typed text into robot speech. Equipped models may include an optional printer for tickets, receipts or visitor information when the workflow requires it.

For projects in Colombia, Latin America and Spain, this category matches searches for reception robots, visitor assistance and service automation in hotels, universities and corporate buildings.$ime_txt$,
  aplicaciones_es = ARRAY['Recepción y orientación de visitantes', 'Orientacion de visitantes en edificios', 'Atencion remota con videooperador', 'Mensajes institucionales y promocionales en lobby', 'Automatización comercial e industrial de servicios']::text[],
  aplicaciones_en = ARRAY['Visitor reception and wayfinding', 'Visitor wayfinding inside buildings', 'Remote assistance with video operator', 'Institutional and promotional lobby messaging', 'Commercial and industrial service automation']::text[],
  atributos = COALESCE(atributos, '{}'::jsonb) || jsonb_build_object(
    'beneficios_es', $ime_json$["Pantalla corporal amplia para comunicacion visual","Reconocimiento facial con saludos por grupos registrados","Navegacion por mapas con puntos, zonas restringidas y limites","Videollamada remota bidireccional o unidireccional","Opcion de impresora para flujos de recepcion"]$ime_json$::jsonb,
    'beneficios_en', $ime_json$["Large body screen for visual communication","Face recognition with registered group greetings","Map navigation with points, restricted areas and limits","Two-way or one-way remote video calls","Optional printer for reception workflows"]$ime_json$::jsonb,
    'valor_es', $ime_txt$PadBot X3 refuerza la primera linea de atención y convierte el lobby en un punto automatizado de orientación, respuesta y experiencia.$ime_txt$,
    'valor_en', $ime_txt$PadBot X3 strengthens front-desk service and turns the lobby into an automated point for guidance, answers and experience.$ime_txt$,
    'seo_keywords_es', $ime_json$["PadBot X3 Robot de Recepción","PadBot","Robots de recepción y atención","robots de servicio","robots para clínicas","robots para hospitales","robots para centros médicos","automatización institucional","robótica de servicio","robots industriales de servicio","robots para logística interna","robots comerciales para empresas","robots en Colombia","robots de servicio Latinoamérica","robots para hospitales Latinoamérica","robots para hospitales España","robot de recepción","robot recepcionista","robot de atención al cliente","robot guía para visitantes","robot humanoide de servicio","robot con reconocimiento facial","robot con interacción por voz","robot con pantalla publicitaria","kiosco robótico móvil","automatización de recepción","robots para IPS","robots para EPS","robots para hoteles y clínicas"]$ime_json$::jsonb,
    'seo_keywords_en', $ime_json$["PadBot X3 Reception Robot","PadBot","Reception and customer service robots","service robots","clinic robots","robots for medical centers","institutional automation","service robotics","industrial service robots","internal logistics robots","commercial robots for companies","robots in Colombia","service robots Latin America","reception robot","front desk robot","customer service robot","visitor guidance robot","humanoid service robot","face recognition robot","voice interaction robot","advertising screen robot","mobile robotic kiosk","reception automation","robots for healthcare providers","robots for hotels and clinics"]$ime_json$::jsonb
  )
WHERE slug = 'padbot-x3-robot-recepcion-ref-padbot-x3-padbot';

UPDATE productos SET
  descripcion_corta_es = $ime_txt$Robot interactivo de servicio con pantalla de cabeza de 10.1 pulgadas, pantalla corporal de 15.6 pulgadas, 4G/WiFi y navegación autónoma por mapas.$ime_txt$,
  descripcion_corta_en = $ime_txt$Interactive service robot with 10.1-inch head screen, 15.6-inch body screen, 4G/WiFi and autonomous map navigation.$ime_txt$,
  descripcion_larga_es = $ime_txt$PadBot X2 es una solución compacta para atención, orientación y comunicación en puntos de servicio. Combina interacción por voz, Q&A personalizado, reconocimiento facial, reproducción de anuncios en modo reposo y videollamada remota con control de movimiento desde la app.

Su navegación se gestiona mediante mapas con puntos objetivo, puntos de carga, zonas restringidas, muros virtuales, zonas transitables, límites de velocidad y puntos asociados a ascensores o accesos. Esto permite instalarlo en recepciones, salas de espera, centros comerciales, instituciones educativas y edificios corporativos donde se requiere guiar usuarios y automatizar respuestas frecuentes.

La batería de 20000 mAh y su peso de 15 kg lo hacen una alternativa liviana frente a robots de recepción de mayor formato, manteniendo pantalla corporal para comunicación visual y presencia de marca.

Para proyectos en Colombia, Latinoamérica y España, esta categoría responde a búsquedas de robots de recepción, atención a visitantes y automatización de servicios en hoteles, universidades y edificios corporativos.$ime_txt$,
  descripcion_larga_en = $ime_txt$PadBot X2 is a compact solution for assistance, wayfinding and communication at service points. It combines voice interaction, customizable Q&A, face recognition, sleep-mode advertising playback and remote video calls with movement control from the app.

Navigation is managed through maps with target points, charging points, restricted areas, virtual walls, passable areas, speed limits and points associated with elevators or access gates. This makes it suitable for reception areas, waiting rooms, shopping centers, educational institutions and corporate buildings where users need guidance and frequent answers can be automated.

Its 20000 mAh battery and 15 kg weight make it a lighter alternative to larger reception robots, while preserving a body screen for visual communication and brand presence.

For projects in Colombia, Latin America and Spain, this category matches searches for reception robots, visitor assistance and service automation in hotels, universities and corporate buildings.$ime_txt$,
  aplicaciones_es = ARRAY['Puntos de informacion y orientacion', 'Salas de espera y recepciones compactas', 'Promocion institucional en pantalla', 'Atencion remota por video', 'Automatización comercial e industrial de servicios']::text[],
  aplicaciones_en = ARRAY['Information and wayfinding points', 'Waiting rooms and compact receptions', 'Institutional promotion on screen', 'Remote video assistance', 'Commercial and industrial service automation']::text[],
  atributos = COALESCE(atributos, '{}'::jsonb) || jsonb_build_object(
    'beneficios_es', $ime_json$["Formato liviano con doble pantalla","Bateria de 20000 mAh para jornadas extendidas","Reconocimiento facial y Q&A configurable","Mapas con zonas restringidas y puntos de destino","Auto carga desde base cuando se habilita en app"]$ime_json$::jsonb,
    'beneficios_en', $ime_json$["Lightweight format with dual screen","20000 mAh battery for extended shifts","Face recognition and configurable Q&A","Maps with restricted areas and destination points","Auto-charge from dock when enabled in app"]$ime_json$::jsonb,
    'valor_es', $ime_txt$PadBot X2 automatiza orientación y atención de primer nivel sin ocupar el espacio físico de un punto fijo tradicional.$ime_txt$,
    'valor_en', $ime_txt$PadBot X2 automates guidance and first-line service without taking the space of a traditional fixed desk.$ime_txt$,
    'seo_keywords_es', $ime_json$["PadBot X2 Robot de Servicio Interactivo","PadBot","Robots de recepción y atención","robots de servicio","robots para clínicas","robots para hospitales","robots para centros médicos","automatización institucional","robótica de servicio","robots industriales de servicio","robots para logística interna","robots comerciales para empresas","robots en Colombia","robots de servicio Latinoamérica","robots para hospitales Latinoamérica","robots para hospitales España","robot de recepción","robot recepcionista","robot de atención al cliente","robot guía para visitantes","robot humanoide de servicio","robot con reconocimiento facial","robot con interacción por voz","robot con pantalla publicitaria","kiosco robótico móvil","automatización de recepción","robots para IPS","robots para EPS","robots para hoteles y clínicas"]$ime_json$::jsonb,
    'seo_keywords_en', $ime_json$["PadBot X2 Interactive Service Robot","PadBot","Reception and customer service robots","service robots","clinic robots","robots for medical centers","institutional automation","service robotics","industrial service robots","internal logistics robots","commercial robots for companies","robots in Colombia","service robots Latin America","reception robot","front desk robot","customer service robot","visitor guidance robot","humanoid service robot","face recognition robot","voice interaction robot","advertising screen robot","mobile robotic kiosk","reception automation","robots for healthcare providers","robots for hotels and clinics"]$ime_json$::jsonb
  )
WHERE slug = 'padbot-x2-robot-servicio-interactivo-ref-padbot-x2-padbot';

UPDATE productos SET
  descripcion_corta_es = $ime_txt$Robot de telepresencia plegable con pantalla HD de 10 pulgadas, WiFi/4G, video llamada, control remoto y auto carga.$ime_txt$,
  descripcion_corta_en = $ime_txt$Foldable telepresence robot with 10-inch HD screen, WiFi/4G, video calling, remote control and auto charging.$ime_txt$,
  descripcion_larga_es = $ime_txt$PadBot P2 está pensado para presencia remota, acompañamiento virtual y atención con operador a distancia. Su pantalla HD de 10 pulgadas, cuerpo plegable, conectividad WiFi/4G y sistema de video llamada permiten que un usuario remoto se desplace, converse, vea el entorno y controle el robot desde la aplicación PadBot Admin.

El equipo incorpora PadBot AI Brain para comunicación por voz, preguntas y respuestas personalizadas, reconocimiento facial, fotos, bloqueo de pantalla, mensajes de bienvenida y gestión de permisos entre administrador y usuarios normales. La función de video unidireccional permite que el operador observe la escena y controle el robot sin mostrar su video al público cuando el flujo lo requiere.

P2 puede apoyar rondas administrativas, visitas remotas, acompañamiento en instituciones educativas y recepción secundaria, como herramienta de comunicación y no como dispositivo médico.

Para presencia remota en Colombia, Latinoamérica y España, este modelo cubre búsquedas de robot de telepresencia, acompañamiento virtual y visitas remotas.$ime_txt$,
  descripcion_larga_en = $ime_txt$PadBot P2 is designed for remote presence, virtual accompaniment and operator-assisted service. Its 10-inch HD screen, foldable body, WiFi/4G connectivity and video calling system allow a remote user to move, talk, view the environment and control the robot from the PadBot Admin app.

The device includes PadBot AI Brain for voice communication, customized Q&A, face recognition, photos, screen lock, welcome messages and permission management between administrators and normal users. One-way video mode lets an operator observe the on-site scene and control the robot without showing the remote video to the public when the workflow requires it.

P2 can support administrative rounds, remote visits, educational accompaniment and secondary reception, as a communication tool rather than a medical device.

For remote presence in Colombia, Latin America and Spain, this model covers searches for telepresence robots, virtual accompaniment and remote visits.$ime_txt$,
  aplicaciones_es = ARRAY['Telepresencia y comunicación en instalaciones', 'Rondas administrativas remotas', 'Visitas remotas', 'Videollamada y control remoto', 'Automatización comercial e industrial de servicios']::text[],
  aplicaciones_en = ARRAY['Telepresence and on-site communication', 'Remote administrative rounds', 'Remote visits', 'Video calls and remote control', 'Commercial and industrial service automation']::text[],
  atributos = COALESCE(atributos, '{}'::jsonb) || jsonb_build_object(
    'beneficios_es', $ime_json$["Cuerpo plegable y peso de 6.5 kg","WiFi y 4G con Micro-SIM","Video llamada bidireccional o unidireccional","Reconocimiento facial y Q&A personalizable","Auto carga desde base cuando se habilita en app"]$ime_json$::jsonb,
    'beneficios_en', $ime_json$["Foldable body and 6.5 kg weight","WiFi and 4G with Micro-SIM","Two-way or one-way video calling","Face recognition and customizable Q&A","Auto-charge from dock when enabled in app"]$ime_json$::jsonb,
    'valor_es', $ime_txt$PadBot P2 acerca administrativos y acompañantes remotos a espacios físicos sin desplazar personas.$ime_txt$,
    'valor_en', $ime_txt$PadBot P2 brings remote administrators and companions into physical spaces without moving people.$ime_txt$,
    'seo_keywords_es', $ime_json$["PadBot P2 Robot de Telepresencia","PadBot","Robots de telepresencia","robots de servicio","robots para clínicas","robots para hospitales","robots para centros médicos","automatización institucional","robótica de servicio","robots industriales de servicio","robots para logística interna","robots comerciales para empresas","robots en Colombia","robots de servicio Latinoamérica","robots para hospitales Latinoamérica","robots para hospitales España","robot de telepresencia","robot para visitas remotas","robot para acompañamiento virtual"]$ime_json$::jsonb,
    'seo_keywords_en', $ime_json$["PadBot P2 Telepresence Robot","PadBot","Telepresence robots","service robots","clinic robots","robots for medical centers","institutional automation","service robotics","industrial service robots","internal logistics robots","commercial robots for companies","robots in Colombia","service robots Latin America","telepresence robot","remote visit robot","virtual accompaniment robot"]$ime_json$::jsonb
  )
WHERE slug = 'padbot-p2-robot-telepresencia-ref-padbot-p2-padbot';

UPDATE productos SET
  descripcion_corta_es = $ime_txt$Robot de delivery con locker, pantalla de 10.1 pulgadas, navegación por mapas, 4G/WiFi, sensores anti-colisión y base de carga.$ime_txt$,
  descripcion_corta_en = $ime_txt$Delivery robot with locker, 10.1-inch screen, map navigation, 4G/WiFi, anti-collision sensors and charging dock.$ime_txt$,
  descripcion_larga_es = $ime_txt$PadBot W2 está orientado a transporte interno y delivery institucional en sedes donde se requiere mover elementos entre puntos definidos con trazabilidad operativa. Integra locker, pantalla de 10.1 pulgadas, conectividad 4G/WiFi, botón de parada de emergencia y sensores anti-colisión y anti-caída.

La plataforma permite crear mapas, editar puntos objetivo, puntos de carga, espera de ascensor, puntos de acceso, cambio de mapa, muros virtuales, zonas restringidas, áreas transitables y límites de velocidad. Esta granularidad ayuda a adaptar el robot a corredores, lobbies, áreas administrativas, hoteles, universidades y espacios de servicio con rutas repetitivas.

Para logística institucional en Colombia, Latinoamérica y España, esta solución se alinea con búsquedas de robots industriales de servicio, transporte interno de insumos y documentos y automatización de rutas repetitivas.$ime_txt$,
  descripcion_larga_en = $ime_txt$PadBot W2 is aimed at internal transport and institutional delivery in facilities that need to move items between defined points with operational traceability. It integrates a locker, 10.1-inch screen, 4G/WiFi connectivity, emergency stop button and anti-collision and anti-fall sensors.

The platform supports map creation, editable target points, charging points, elevator waiting points, access points, map switching, virtual walls, restricted areas, passable areas and speed limits. This granularity helps adapt the robot to corridors, lobbies, administrative areas, hotels, universities and service spaces with repetitive routes.

For institutional logistics in Colombia, Latin America and Spain, this solution aligns with searches for industrial service robots, internal transport of supplies and documents and repetitive route automation.$ime_txt$,
  aplicaciones_es = ARRAY['Transporte interno de insumos y documentos', 'Rutas repetitivas en edificios institucionales', 'Hoteles, universidades y sedes corporativas', 'Apoyo logistico en areas administrativas', 'Automatización comercial e industrial de servicios']::text[],
  aplicaciones_en = ARRAY['Internal transport of supplies and documents', 'Repetitive routes inside institutional buildings', 'Hotels, universities and corporate facilities', 'Logistics support in administrative areas', 'Commercial and industrial service automation']::text[],
  atributos = COALESCE(atributos, '{}'::jsonb) || jsonb_build_object(
    'beneficios_es', $ime_json$["Locker integrado para transporte controlado","Mapas con puntos, zonas restringidas y limites de velocidad","Soporte de puntos de ascensor y control de acceso","4G/WiFi para gestion operativa","Boton de emergencia y sensores anti-colision/anti-caida"]$ime_json$::jsonb,
    'beneficios_en', $ime_json$["Integrated locker for controlled transport","Maps with points, restricted areas and speed limits","Support for elevator and access-control points","4G/WiFi for operational management","Emergency button and anti-collision/anti-fall sensors"]$ime_json$::jsonb,
    'valor_es', $ime_txt$PadBot W2 reduce recorridos repetitivos del personal y ordena flujos internos de entrega en sedes con rutas definidas.$ime_txt$,
    'valor_en', $ime_txt$PadBot W2 reduces repetitive staff trips and organizes internal delivery flows in facilities with defined routes.$ime_txt$,
    'seo_keywords_es', $ime_json$["PadBot W2 Robot de Delivery Institucional","PadBot","Robots de delivery institucional","robots de servicio","robots para clínicas","robots para hospitales","robots para centros médicos","automatización institucional","robótica de servicio","robots industriales de servicio","robots para logística interna","robots comerciales para empresas","robots en Colombia","robots de servicio Latinoamérica","robots para hospitales Latinoamérica","robots para hospitales España","robot de delivery institucional","robot de transporte interno","robot para entrega de insumos","robot con locker","robot para rutas internas","delivery autónomo institucional"]$ime_json$::jsonb,
    'seo_keywords_en', $ime_json$["PadBot W2 Institutional Delivery Robot","PadBot","Institutional delivery robots","service robots","clinic robots","robots for medical centers","institutional automation","service robotics","industrial service robots","internal logistics robots","commercial robots for companies","robots in Colombia","service robots Latin America","institutional delivery robot","internal transport robot","supply delivery robot","locker robot","internal route robot","autonomous institutional delivery"]$ime_json$::jsonb
  )
WHERE slug = 'padbot-w2-robot-delivery-institucional-ref-padbot-w2-padbot';

UPDATE productos SET
  descripcion_corta_es = $ime_txt$Robot de delivery de alimentos con bandeja, pantalla publicitaria de 15.6 pulgadas, mapas con puntos de cocina y retorno, 4G/WiFi y base de carga.$ime_txt$,
  descripcion_corta_en = $ime_txt$Food delivery robot with tray, 15.6-inch advertising screen, maps with kitchen and return points, 4G/WiFi and charging dock.$ime_txt$,
  descripcion_larga_es = $ime_txt$PadBot W3s está diseñado para delivery de alimentos y servicio interno en cafeterías, hoteles, restaurantes, comedores institucionales y áreas de hospitalidad. Incorpora bandeja, pantalla de operación de 10.1 pulgadas y pantalla publicitaria de 15.6 pulgadas Full HD para comunicación visual durante el recorrido.

Su software permite crear mapas, editar puntos de destino y usar puntos específicos de cocina y lavaplatos/retorno, además de puntos de carga, muros virtuales, zonas restringidas, zonas transitables y límites de velocidad. Esta orientación funcional lo diferencia de robots de delivery general, ya que está pensado para rutas de servicio de mesa, recogida y retorno.

Para alimentación institucional en Colombia, Latinoamérica y España, este robot responde a búsquedas de robot camarero, robot de delivery de alimentos, robot para hoteles, comedores institucionales y automatización de servicio de mesa.$ime_txt$,
  descripcion_larga_en = $ime_txt$PadBot W3s is designed for food delivery and internal service in cafeterias, hotels, restaurants, institutional dining rooms and hospitality areas. It includes a tray, 10.1-inch operating screen and 15.6-inch Full HD advertising screen for visual communication during routes.

Its software supports map creation, editable destination points and specific kitchen and dishwash/return points, plus charging points, virtual walls, restricted areas, passable areas and speed limits. This functional orientation sets it apart from general delivery robots because it is designed for table service, pick-up and return routes.

For institutional dining in Colombia, Latin America and Spain, this robot targets searches for robot waiter, food delivery robot, hotel robot, institutional dining robot and table service automation.$ime_txt$,
  aplicaciones_es = ARRAY['Cafeterias y restaurantes institucionales', 'Hoteles y servicio de alimentos', 'Comedores empresariales o universitarios', 'Promocion visual durante recorridos', 'Automatización comercial e industrial de servicios']::text[],
  aplicaciones_en = ARRAY['Institutional cafeterias and restaurants', 'Hotels and food service', 'Corporate or university dining rooms', 'Visual promotion during routes', 'Commercial and industrial service automation']::text[],
  atributos = COALESCE(atributos, '{}'::jsonb) || jsonb_build_object(
    'beneficios_es', $ime_json$["Bandeja integrada para servicio de alimentos","Pantalla publicitaria Full HD de 15.6 pulgadas","Puntos de cocina y retorno/lavado en mapas","Rutas con zonas restringidas y limites de velocidad","4G/WiFi y base de carga"]$ime_json$::jsonb,
    'beneficios_en', $ime_json$["Integrated tray for food service","15.6-inch Full HD advertising screen","Kitchen and return/dishwash map points","Routes with restricted areas and speed limits","4G/WiFi and charging dock"]$ime_json$::jsonb,
    'valor_es', $ime_txt$PadBot W3s automatiza recorridos de servicio de alimentos y agrega comunicacion visual durante la entrega.$ime_txt$,
    'valor_en', $ime_txt$PadBot W3s automates food service routes and adds visual communication during delivery.$ime_txt$,
    'seo_keywords_es', $ime_json$["PadBot W3s Robot de Delivery de Alimentos","PadBot","Robots de delivery de alimentos","robots de servicio","robots para clínicas","robots para hospitales","robots para centros médicos","automatización institucional","robótica de servicio","robots industriales de servicio","robots para logística interna","robots comerciales para empresas","robots en Colombia","robots de servicio Latinoamérica","robots para hospitales Latinoamérica","robots para hospitales España","robot de delivery de alimentos","robot camarero","robot para restaurantes","robot para comedores institucionales","robot para hoteles","robot con bandeja","robot de servicio de mesa","robot para hospitalidad","automatización de servicio de alimentos","delivery autónomo de alimentos"]$ime_json$::jsonb,
    'seo_keywords_en', $ime_json$["PadBot W3s Food Delivery Robot","PadBot","Food delivery robots","service robots","clinic robots","robots for medical centers","institutional automation","service robotics","industrial service robots","internal logistics robots","commercial robots for companies","robots in Colombia","service robots Latin America","food delivery robot","robot waiter","restaurant robot","institutional dining robot","hotel service robot","tray robot","table service robot","hospitality robot","food service automation","autonomous food delivery"]$ime_json$::jsonb
  )
WHERE slug = 'padbot-w3s-robot-delivery-alimentos-ref-padbot-w3s-padbot';

UPDATE productos SET
  descripcion_corta_es = $ime_txt$Robot social compacto con pantalla de 5 pulgadas, interacción por voz, cámara gran angular 720P, juegos, video llamada y control desde app.$ime_txt$,
  descripcion_corta_en = $ime_txt$Compact social robot with 5-inch screen, voice interaction, 720P wide-angle camera, games, video calling and app control.$ime_txt$,
  descripcion_larga_es = $ime_txt$PadBot T2 es un robot social de pequeño formato para interacción educativa, acompañamiento y demostraciones de robótica. Integra pantalla de 5 pulgadas, cámara gran angular de 230 grados HD 720P, conectividad WiFi, interacción por voz sin palabra de activación después de conectarse a internet, juegos, música, historias, danza, fotos y video llamada desde la app.

Su tamaño y peso facilitan uso en colegios, universidades, ferias y espacios de experiencia y programas de educación STEAM. El manual describe interacciones táctiles, comandos de movimiento, control por app y respuestas emocionales frente a posiciones o contacto.

I-ME lo clasifica como robot educativo/social y no como equipo biomédico. Su valor comercial está en engagement, educación, demostración tecnológica y acompañamiento ligero en entornos controlados.

Para educación y experiencias institucionales en Colombia, Latinoamérica y España, esta categoría responde a búsquedas de robot educativo, robot social, robot de acompañamiento, robótica STEAM y activaciones tecnológicas.$ime_txt$,
  descripcion_larga_en = $ime_txt$PadBot T2 is a small social robot for educational interaction, accompaniment and robotics demonstrations. It integrates a 5-inch screen, 230-degree HD 720P wide-angle camera, WiFi connectivity, voice interaction without a wake word after internet connection, games, music, stories, dancing, photos and video calling from the app.

Its size and weight make it suitable for schools, universities, fairs and experience areas and STEAM education programs. The manual describes touch interactions, movement commands, app control and emotional responses to position or contact.

I-ME classifies it as an educational/social robot, not as biomedical equipment. Its commercial value lies in engagement, education, technology demonstration and light accompaniment in controlled environments.

For education and institutional experiences in Colombia, Latin America and Spain, this category matches searches for educational robot, social robot, companion robot, STEAM robotics and technology activations.$ime_txt$,
  aplicaciones_es = ARRAY['Educacion STEAM y demostraciones de robotica', 'Interaccion social en espacios controlados', 'Ferias, universidades y activaciones institucionales', 'Acompañamiento en espacios educativos', 'Automatización comercial e industrial de servicios']::text[],
  aplicaciones_en = ARRAY['STEAM education and robotics demonstrations', 'Social interaction in controlled spaces', 'Fairs, universities and institutional activations', 'Accompaniment in educational spaces', 'Commercial and industrial service automation']::text[],
  atributos = COALESCE(atributos, '{}'::jsonb) || jsonb_build_object(
    'beneficios_es', $ime_json$["Formato compacto de 1.68 kg","Camara gran angular HD 720P de 230 grados","Interaccion por voz, tacto, app y video llamada","Juegos, historias, musica, danza y fotografias","Autonomia de 6 h y standby de 18 h"]$ime_json$::jsonb,
    'beneficios_en', $ime_json$["Compact 1.68 kg format","230-degree HD 720P wide-angle camera","Voice, touch, app and video-call interaction","Games, stories, music, dancing and photos","6 h runtime and 18 h standby"]$ime_json$::jsonb,
    'valor_es', $ime_txt$PadBot T2 crea experiencias educativas e interactivas de bajo riesgo para acercar robotica a usuarios, estudiantes y visitantes.$ime_txt$,
    'valor_en', $ime_txt$PadBot T2 creates low-risk educational and interactive experiences that bring robotics closer to users, students and visitors.$ime_txt$,
    'seo_keywords_es', $ime_json$["PadBot T2 Robot Educativo y Social","PadBot","Robots educativos y sociales","robots de servicio","robots para clínicas","robots para hospitales","robots para centros médicos","automatización institucional","robótica de servicio","robots industriales de servicio","robots para logística interna","robots comerciales para empresas","robots en Colombia","robots de servicio Latinoamérica","robots para hospitales Latinoamérica","robots para hospitales España","robot educativo","robot social","robot de acompañamiento","robot para educación STEAM","robot para universidades","robot para colegios","robot para activaciones institucionales","robot de entretenimiento educativo","robótica social"]$ime_json$::jsonb,
    'seo_keywords_en', $ime_json$["PadBot T2 Educational and Social Robot","PadBot","Educational and social robots","service robots","clinic robots","robots for medical centers","institutional automation","service robotics","industrial service robots","internal logistics robots","commercial robots for companies","robots in Colombia","service robots Latin America","educational robot","social robot","companion robot","STEAM education robot","robot for universities","robot for schools","robot for institutional activations","educational entertainment robot","social robotics"]$ime_json$::jsonb
  )
WHERE slug = 'padbot-t2-robot-educativo-social-ref-padbot-t2-padbot';

UPDATE productos SET
  descripcion_corta_es = $ime_txt$Robot humanoide de servicio comercial basado en la nube, diseñado para recepción, interacción con visitantes y experiencias institucionales personalizadas.$ime_txt$,
  descripcion_corta_en = $ime_txt$Cloud-based humanoid commercial service robot for reception, visitor interaction and personalized institutional experiences.$ime_txt$,
  descripcion_larga_es = $ime_txt$Cruzr es un robot comercial inteligente de AHuman Future orientado a automatizar atención presencial, bienvenida y presentación de servicios en espacios institucionales. Su propuesta combina sistema robótico en la nube, API abierta y soluciones personalizables por industria, lo que permite adaptar guiones, interacciones y flujos de atención a cada sede.

Para clínicas, hospitales, hoteles, universidades, centros comerciales y empresas con alto tráfico de visitantes, Cruzr ayuda a reducir tareas repetitivas, optimizar recursos humanos y elevar la calidad percibida del servicio. Su diseño humanoide facilita una experiencia de contacto más amable que un kiosco fijo, mientras sus capacidades de detección facial, navegación estereoscópica, evitación de obstáculos e interacción humano-maquina permiten acompañar recorridos y activar mensajes comerciales o informativos.

I-ME lo posiciona como solución de automatización de experiencia, recepción y mercadeo presencial para instituciones que buscan diferenciar su servicio, mejorar satisfacción y fortalecer imagen corporativa sin depender solo de personal en punto fijo.

Para proyectos en Colombia, Latinoamérica y España, esta categoría responde a búsquedas de robots de recepción, atención a visitantes y automatización de servicios en hoteles, universidades y edificios corporativos.$ime_txt$,
  descripcion_larga_en = $ime_txt$Cruzr is an intelligent commercial service robot from AHuman Future designed to automate in-person assistance, greetings and service presentation in institutional spaces. Its value proposition combines a cloud-based robotic OS, an open API and industry-specific customization, allowing scripts, interactions and service flows to be adapted to each site.

For clinics, hospitals, hotels, universities, shopping centers and companies with high visitor traffic, Cruzr helps reduce repetitive tasks, optimize human resources and improve perceived service quality. Its humanoid design creates a friendlier touchpoint than a fixed kiosk, while face detection, stereoscopic navigation, real-time obstacle avoidance and human-machine interaction support guided experiences and commercial or informational messaging.

I-ME positions Cruzr as an experience automation, reception and on-site marketing solution for institutions that want to differentiate service, improve satisfaction and strengthen brand image without relying only on fixed-front-desk staffing.

For projects in Colombia, Latin America and Spain, this category matches searches for reception robots, visitor assistance and service automation in hotels, universities and corporate buildings.$ime_txt$,
  aplicaciones_es = ARRAY['Recepcion institucional y bienvenida de visitantes', 'Orientación en edificios corporativos e institucionales', 'Presentacion comercial en puntos de alto trafico', 'Automatizacion de preguntas frecuentes y mensajes de marca', 'Automatización comercial e industrial de servicios']::text[],
  aplicaciones_en = ARRAY['Institutional reception and visitor greeting', 'Wayfinding in corporate and institutional buildings', 'Commercial presentation in high-traffic points', 'FAQ automation and brand messaging', 'Commercial and industrial service automation']::text[],
  atributos = COALESCE(atributos, '{}'::jsonb) || jsonb_build_object(
    'beneficios_es', $ime_json$["Sistema robotico basado en la nube con API abierta","Deteccion facial e interaccion humano-maquina","Navegacion estereoscopica con evitacion de obstaculos en tiempo real","Mensajes, presentaciones y flujos personalizables por industria","Reduce tareas repetitivas y mejora experiencia del visitante"]$ime_json$::jsonb,
    'beneficios_en', $ime_json$["Cloud-based robotic OS with open API","Face detection and human-machine interaction","Stereoscopic navigation with real-time obstacle avoidance","Industry-specific messages, presentations and flows","Reduces repetitive tasks and improves visitor experience"]$ime_json$::jsonb,
    'valor_es', $ime_txt$Cruzr convierte recepcion y puntos de informacion en un canal activo de servicio, orientacion y marketing institucional.$ime_txt$,
    'valor_en', $ime_txt$Cruzr turns reception and information points into an active channel for service, wayfinding and institutional marketing.$ime_txt$,
    'seo_keywords_es', $ime_json$["Cruzr Robot Comercial Inteligente AHuman Future","AHuman Future","Robots de recepción y atención","robots de servicio","robots para clínicas","robots para hospitales","robots para centros médicos","automatización institucional","robótica de servicio","robots industriales de servicio","robots para logística interna","robots comerciales para empresas","robots en Colombia","robots de servicio Latinoamérica","robots para hospitales Latinoamérica","robots para hospitales España","robot de recepción","robot recepcionista","robot de atención al cliente","robot guía para visitantes","robot humanoide de servicio","robot con reconocimiento facial","robot con interacción por voz","robot con pantalla publicitaria","kiosco robótico móvil","automatización de recepción","robots para IPS","robots para EPS","robots para hoteles y clínicas"]$ime_json$::jsonb,
    'seo_keywords_en', $ime_json$["Cruzr Intelligent Commercial Service Robot AHuman Future","AHuman Future","Reception and customer service robots","service robots","clinic robots","robots for medical centers","institutional automation","service robotics","industrial service robots","internal logistics robots","commercial robots for companies","robots in Colombia","service robots Latin America","reception robot","front desk robot","customer service robot","visitor guidance robot","humanoid service robot","face recognition robot","voice interaction robot","advertising screen robot","mobile robotic kiosk","reception automation","robots for healthcare providers","robots for hotels and clinics"]$ime_json$::jsonb
  )
WHERE slug = 'cruzr-robot-comercial-inteligente-ref-cruzr-ahuman-future-ahuman-future';

UPDATE landings SET
  contenido_es = replace(replace(replace(replace(replace(replace(replace(contenido_es::text,
    'logística intrahospitalaria', 'logística interna'),
    'Logística intrahospitalaria', 'Logística interna'),
    'Telepresencia médica y rondas clínicas', 'Telepresencia y comunicación en instalaciones'),
    'Rondas y telepresencia médica', 'Telepresencia y comunicación en instalaciones'),
    'Telepresencia médica', 'Telepresencia y comunicación en instalaciones'),
    'muestras, medicamentos o documentos', 'el transporte interno de insumos y documentos'),
    'telepresencia médica', 'telepresencia y comunicación en instalaciones')::jsonb,
  contenido_en = replace(replace(replace(replace(replace(replace(replace(contenido_en::text,
    'in-hospital logistics', 'internal logistics'),
    'In-hospital logistics', 'Internal logistics'),
    'Medical telepresence and clinical rounds', 'Telepresence and on-site communication'),
    'Rounds and medical telepresence', 'Telepresence and on-site communication'),
    'Medical telepresence', 'Telepresence and on-site communication'),
    'medical telepresence', 'telepresence and on-site communication'),
    'samples, medication or documents', 'internal transport of supplies and documents')::jsonb
WHERE (tipo = 'familia' AND clave = 'robots')
   OR (tipo = 'campana' AND clave = 'robotica_rehabilitacion');

UPDATE articulos SET
  titulo_es = replace(titulo_es,
    'Robots asistenciales en la atención',
    'Robots de servicio en la operación'),
  titulo_en = replace(titulo_en,
    'Assistive robots in care settings',
    'Service robots in operations'),
  cuerpo_es = replace(replace(replace(replace(replace(cuerpo_es,
    'robots asistenciales / de servicio', 'robots de servicio'),
    'robots asistenciales', 'robots de servicio'),
    'robot asistencial', 'robot de servicio'),
    'campañas de vacunación', 'campañas'),
    'un especialista o supervisor', 'un supervisor'),
  cuerpo_en = replace(replace(replace(cuerpo_en,
    'Assistive / service robots', 'Service robots'),
    'assistive robots', 'service robots'),
    'an assistive robot', 'a service robot')
WHERE slug = 'robots-asistenciales-atencion-reduccion-carga-personal';
