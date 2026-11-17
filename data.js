// Zentrale Datenquelle für die Reise (Plan Version 5, Stand 17.11.2026).
// Keine Buchungsnummern oder privaten Daten hier eintragen: Dieses Repo ist öffentlich.
// Buchungsstatus, Nummern, Notizen und Ausgaben liegen nur im Sync-Speicher.

window.TRIP = {
  title: "Schottland Februar 2027",
  start: "2027-02-18",
  end: "2027-02-25",
  people: ["Rik", "Melina"],
  gbpToEur: 1.17, // Richtwert, in der App unter Geld änderbar

  points: {
    air: [55.95, -3.3725, "Flughafen"],
    edi: [55.9533, -3.1883, "Edinburgh"],
    gla: [55.8642, -4.2518, "Glasgow"],
    glc: [56.6676, -4.9866, "Three Sisters"],
    fw: [56.8198, -5.1052, "Fort William"],
    glf: [56.8706, -5.4363, "Glenfinnan"],
    com: [56.8995, -4.9568, "Commando Memorial"],
    urq: [57.324, -4.442, "Urquhart Castle"],
    inv: [57.4778, -4.2247, "Inverness"],
    car: [57.2836, -3.8137, "Carrbridge"],
    tan: [56.0563, -2.6508, "Tantallon"],
    sta: [55.916, -2.139, "St Abb's Head"]
  },

  days: [
    {
      id: "d1", date: "2027-02-18", label: "Tag 1 · Do 18.02.", title: "Ankommen in Edinburgh",
      drive: "0:30 h", friend: false, night: "Edinburgh", sun: ["07:31", "17:22"], weather: "2650225",
      legs: [["air", "edi"]],
      start: "12:45", end: "21:00",
      route: ["Edinburgh Airport, Edinburgh EH12 9DN", "JA The Bruntsfield, 69-74 Bruntsfield Place, Edinburgh EH10 4HH"],
      stops: [
        ["12:45", "Landung, Mietwagen am Flughafen abholen", "Edinburgh Airport, Edinburgh EH12 9DN"],
        ["ca. 14:00", "Hotel, Auto abstellen", "JA The Bruntsfield, 69-74 Bruntsfield Place, Edinburgh EH10 4HH"],
        ["abends", "Altstadt und Royal Mile", "St Giles' Cathedral, High Street, Edinburgh EH1 1RE"]
      ],
      tips: ["Erste Fahrt im Linksverkehr: Navi vor dem Losfahren einstellen, die Strecke hat mehrere Kreisverkehre."]
    },
    {
      id: "d2", date: "2027-02-19", label: "Tag 2 · Fr 19.02.", title: "Ein ganzer Tag Glasgow",
      drive: "1:10 h", friend: true, night: "Glasgow", sun: ["07:33", "17:29"], weather: "2648579",
      legs: [["edi", "gla"]],
      start: "10:00", end: "22:00",
      route: ["JA The Bruntsfield, 69-74 Bruntsfield Place, Edinburgh EH10 4HH", "Courtyard by Marriott Glasgow SEC, 16 Stobcross Road, Glasgow G3 8GS"],
      stops: [
        ["10:00", "Abfahrt in Edinburgh", "JA The Bruntsfield, 69-74 Bruntsfield Place, Edinburgh EH10 4HH"],
        ["11:15", "Ankunft Glasgow, Auto ins Hotelparkhaus", "Courtyard by Marriott Glasgow SEC, 16 Stobcross Road, Glasgow G3 8GS"],
        ["mittags", "Shoppen an der Buchanan Street", "Buchanan Street, Glasgow G1"],
        ["bis 17:00", "Kelvingrove und West End (frei, ab 11 Uhr offen)", "Kelvingrove Art Gallery and Museum, Argyle Street, Glasgow G3 8AG"],
        ["abends", "Abendessen in der Ashton Lane", "Ashton Lane, Glasgow G12 8SJ"]
      ],
      tips: ["Check-in meist erst ab 15 Uhr. Gepäck im Auto lassen oder an der Rezeption abgeben.", "Innenstadt ist Umweltzone: zu Fuß oder mit der U-Bahn, nicht mit dem Auto."]
    },
    {
      id: "d3", date: "2027-02-20", label: "Tag 3 · Sa 20.02.", title: "Glencoe und die Harry-Potter-Brücke",
      drive: "3:45 h", friend: true, night: "Fort William", sun: ["07:36", "17:32"], weather: "2649169",
      legs: [["gla", "glc", "fw", "glf", "fw"]],
      start: "10:00", end: "18:30",
      stops: [
        ["10:00", "Abfahrt, am Loch Lomond entlang", "Courtyard by Marriott Glasgow SEC, 16 Stobcross Road, Glasgow G3 8GS"],
        ["ca. 12:15", "Three Sisters, Glencoe", "Three Sisters Viewpoint, A82, Glencoe, Ballachulish"],
        ["ca. 13:20", "Mittag und Check-in in Fort William", "Nevis Bank Inn, Belford Road, Fort William PH33 6PF"],
        ["ca. 16:20", "Foto-Spot am Glenfinnan-Viadukt", "Glenfinnan Viaduct Viewpoint, Glenfinnan PH37 4LT"],
        ["ca. 18:00", "Zurück ins Hotel", "Nevis Bank Inn, Belford Road, Fort William PH33 6PF"]
      ],
      route: ["Courtyard by Marriott Glasgow SEC, 16 Stobcross Road, Glasgow G3 8GS", "Three Sisters Viewpoint, A82, Glencoe, Ballachulish", "Nevis Bank Inn, Belford Road, Fort William PH33 6PF", "Glenfinnan Viaduct Viewpoint, Glenfinnan PH37 4LT", "Nevis Bank Inn, Belford Road, Fort William PH33 6PF"],
      tips: [
        "Zug über das Viadukt laut Fahrplan 2026 gegen 16:50 und 16:55. Für Februar 2027 nicht bestätigt, zeitweise fahren Ersatzbusse. Zwei Tage vorher in der ScotRail-App prüfen.",
        "Zwischen 13:20 und 15:45 ist Puffer für die A82 bei Schnee. Sonst Spaziergang am Loch Linnhe.",
        "Glenfinnan: Parken am Visitor Centre, 15 Minuten zu Fuß zum Viewpoint. Sonnenuntergang 17:32."
      ]
    },
    {
      id: "d4", date: "2027-02-21", label: "Tag 4 · So 21.02.", title: "Loch Ness und zurück nach Edinburgh",
      drive: "ca. 5:00 h", friend: true, night: "Edinburgh", sun: ["07:34", "17:34"], weather: "2646088",
      legs: [["fw", "com", "urq", "inv", "car", "edi"]],
      start: "10:00", end: "17:15",
      stops: [
        ["10:00", "Abfahrt in Fort William", "Nevis Bank Inn, Belford Road, Fort William PH33 6PF"],
        ["10:15", "Commando Memorial, kurzer Fotostopp", "Commando Memorial, Spean Bridge PH34 4EG"],
        ["ca. 11:30", "Urquhart Castle am Loch Ness, mit Café (Zeitfenster gebucht)", "Urquhart Castle, Drumnadrochit, Inverness IV63 6XJ"],
        ["ca. 13:45", "Carrbridge, alte Steinbrücke, Kaffeepause", "Old Packhorse Bridge, Carrbridge"],
        ["ca. 17:00", "Edinburgh, Hotel. Freundin nimmt den Zug nach Glasgow", "JA The Bruntsfield, 69-74 Bruntsfield Place, Edinburgh EH10 4HH"]
      ],
      tips: [
        "Geändert: Pause in Inverness und Ruthven Barracks gestrichen. So seid ihr über den Drumochter Pass (A9), bevor es um 17:34 dunkel wird.",
        "Morgens Traffic Scotland prüfen. Kritisch sind die A82 und die A9.",
        "Zug Edinburgh nach Glasgow fährt häufig, rund 50 Minuten."
      ]
    },
    {
      id: "d5", date: "2027-02-22", label: "Tag 5 · Mo 22.02.", title: "Edinburgh, Tag eins",
      drive: "kein Auto", friend: false, night: "Edinburgh", sun: ["07:22", "17:31"], weather: "2650225",
      legs: [],
      start: "11:00", end: "19:00",
      stops: [
        ["12:00", "Edinburgh Castle (online gebucht, letzter Einlass 16 Uhr)", "Edinburgh Castle, Castlehill, Edinburgh EH1 2NG"],
        ["nachmittags", "Royal Mile und Victoria Street", "Victoria Street, Edinburgh EH1"],
        ["ca. 17:00", "Calton Hill zum Sonnenuntergang (17:31)", "Calton Hill, Edinburgh EH7 5AA"]
      ],
      tips: ["Klippentag, Burgtag und Shoppingtag lassen sich je nach Wetter frei tauschen."]
    },
    {
      id: "d6", date: "2027-02-23", label: "Tag 6 · Di 23.02.", title: "Klippen der Ostküste",
      drive: "3:00 h", friend: false, night: "Edinburgh", sun: ["07:19", "17:33"], weather: "2650225",
      legs: [["edi", "tan", "sta", "edi"]],
      start: "10:00", end: "17:00",
      stops: [
        ["10:00", "Abfahrt in Edinburgh", "JA The Bruntsfield, 69-74 Bruntsfield Place, Edinburgh EH10 4HH"],
        ["ca. 10:50", "Tantallon Castle, Burgruine auf der Klippe (10 bis 16 Uhr)", "Tantallon Castle, North Berwick EH39 5PN"],
        ["mittags", "Mittag am Hafen von North Berwick", "North Berwick Harbour, Victoria Road, North Berwick"],
        ["ca. 14:00", "St Abb's Head, die hohen Klippen", "St Abb's Head National Nature Reserve, St Abbs, Eyemouth TD14 5QF"],
        ["ca. 17:00", "Zurück in Edinburgh", "JA The Bruntsfield, 69-74 Bruntsfield Place, Edinburgh EH10 4HH"]
      ],
      tips: ["Tantallon: Eintritt online 7,50 £, vor Ort 8,50 £. Der Ostturm ist gesperrt.", "Bei Sturm mit Tag 5 oder Tag 7 tauschen."]
    },
    {
      id: "d7", date: "2027-02-24", label: "Tag 7 · Mi 24.02.", title: "Edinburgh, Tag zwei: Shoppen",
      drive: "kein Auto", friend: false, night: "Edinburgh", sun: ["07:17", "17:35"], weather: "2650225",
      legs: [],
      start: "10:30", end: "19:00",
      stops: [
        ["vormittags", "Princes Street und George Street", "Princes Street, Edinburgh EH2"],
        ["mittags", "St James Quarter", "St James Quarter, St James Crescent, Edinburgh EH1 3AD"],
        ["nachmittags", "Dean Village oder Arthur's Seat", "Dean Village, Edinburgh EH4 3AY"]
      ],
      tips: ["Bei Regen: National Museum of Scotland statt Arthur's Seat."]
    },
    {
      id: "d8", date: "2027-02-25", label: "Tag 8 · Do 25.02.", title: "Heimflug",
      drive: "0:30 h", friend: false, night: "", sun: ["07:15", "17:37"], weather: "2650225",
      legs: [["edi", "air"]],
      start: "10:15", end: "13:35",
      stops: [
        ["10:15", "Abfahrt, volltanken", "JA The Bruntsfield, 69-74 Bruntsfield Place, Edinburgh EH10 4HH"],
        ["11:00", "Mietwagen zurück, Abflug 13:35", "Edinburgh Airport, Edinburgh EH12 9DN"]
      ],
      tips: []
    }
  ],

  // Buchungen: Status, Nummer und Stornofrist werden nur im Sync-Speicher abgelegt.
  bookings: [
    { id: "eta", title: "ETA Einreisegenehmigung für beide", due: "2027-02-04", info: "Pflicht für deutsche Pässe. 20 £ pro Person, App UK ETA oder gov.uk/eta. Entscheidung meist in 1 Tag, bis 3 Werktage.", link: "https://www.gov.uk/eta/apply" },
    { id: "car", title: "Mietwagen ab Flughafen Edinburgh", due: "2026-12-15", info: "Do 18.02. ab 13:00 bis Do 25.02. 11:00. Automatik, Vollkasko ohne Selbstbeteiligung, Zweitfahrer, Winter- oder Ganzjahresreifen.", link: "https://www.google.com/search?q=mietwagen+edinburgh+airport+18.02.2027" },
    { id: "h1", title: "Hotel Edinburgh 18. bis 19.02.", due: "2026-12-15", info: "Vorschlag JA The Bruntsfield, 93 €. Parkplatz bestätigen lassen.", hotel: ["JA The Bruntsfield Edinburgh", "2027-02-18", "2027-02-19", 2] },
    { id: "h2", title: "Glasgow 19. bis 20.02. (Hotel oder bei der Freundin)", due: "2026-12-15", info: "Vorschlag Courtyard by Marriott Glasgow SEC, 85 € plus Parkhaus. Entfällt, wenn ihr bei ihr schlaft.", hotel: ["Courtyard by Marriott Glasgow SEC", "2027-02-19", "2027-02-20", 2] },
    { id: "h3", title: "Hotel Fort William 20. bis 21.02.", due: "2026-12-15", info: "Vorschlag Nevis Bank Inn, 120 € für 2. Zu dritt: Dreibettzimmer oder zweites Zimmer, ca. 80 bis 120 € mehr.", hotel: ["Nevis Bank Inn Fort William", "2027-02-20", "2027-02-21", 3] },
    { id: "h4", title: "Hotel Edinburgh 21. bis 25.02.", due: "2026-12-15", info: "Vorschlag JA The Bruntsfield, 369 €. Dazu 5 % Visitor Levy.", hotel: ["JA The Bruntsfield Edinburgh", "2027-02-21", "2027-02-25", 2] },
    { id: "urq", title: "Urquhart Castle: Ticket mit Parkplatz-Slot", due: "2027-02-07", info: "So 21.02. ca. 11:30. Online 14 £ pro Person, Parkplatz nur mit Online-Buchung garantiert.", link: "https://www.historicenvironment.scot/visit/all/urquhart-castle/plan-your-visit/" },
    { id: "edc", title: "Edinburgh Castle: Tickets für Mo 22.02. 12 Uhr", due: "2027-02-07", info: "Online 23,50 £ pro Person, oft ausverkauft.", link: "https://www.edinburghcastle.scot/" },
    { id: "ins", title: "Auslandsreise-Krankenversicherung prüfen", due: "2027-02-01", info: "Gilt eure bestehende Versicherung für Großbritannien?", link: "" }
  ],

  todos: [
    { id: "friend-sun", text: "Mit der Freundin klären: Sonntag bis Edinburgh mitfahren, dann Zug nach Glasgow" },
    { id: "friend-fri", text: "Freitag bei ihr schlafen oder Hotel in Glasgow?" },
    { id: "friend-fw", text: "Fort William zu dritt: Dreibettzimmer oder zweites Zimmer?" },
    { id: "parking", text: "Bruntsfield: Ist der Parkplatz kostenlos? Wenn nicht, Auto von So bis Di zurückgeben prüfen" },
    { id: "storno", text: "Alle Hotels kostenlos stornierbar buchen" },
    { id: "passport", text: "Pässe bis nach dem Rückflug gültig" },
    { id: "credit", text: "Kreditkarte mit genug Rahmen für die Mietwagen-Kaution" },
    { id: "offline", text: "Google-Maps-Offlinekarte Schottland auf beiden Handys laden", due: "2027-02-16" },
    { id: "rail", text: "Zug über das Viadukt und Ersatzbusse in der ScotRail-App prüfen", due: "2027-02-18" },
    { id: "lez", text: "Bei Abholung: Mietwagen erfüllt die Umweltzone (Benzin Euro 4, Diesel Euro 6)" },
    { id: "annika", text: "Annikas Liste mit den Stopps abgleichen" }
  ],

  packing: [
    "Pässe und ETA", "Führerscheine (beide)", "Kreditkarte für die Kaution", "Regenjacke", "Warme Schichten und Fleece",
    "Mütze, Schal, Handschuhe", "Wasserfeste Schuhe", "Sonnenbrille (tief stehende Sonne beim Fahren)",
    "Adapter Typ G (2 Stück)", "Powerbank", "Handyhalterung und Ladekabel fürs Auto", "Thermoskanne und Snacks für die Highlands",
    "Reiseapotheke", "Kamera und Speicherkarten"
  ],

  budget: [
    ["Hotels laut Vorschlag (7 Nächte)", "667 €", "ca. 770 € mit drittem Bett in Fort William"],
    ["Visitor Levy Edinburgh (5 %)", "ca. 23 €", "seit 24.07.2026"],
    ["Mietwagen inkl. Vollkasko", "350 bis 600 €", "Live-Preise fehlen noch"],
    ["Sprit, ca. 880 km", "ca. 105 €", "bei 7 l pro 100 km"],
    ["Parken", "30 bis 50 €", "Glasgow, Glenfinnan, Aussichtspunkte"],
    ["Eintritte für 2", "90 £, ca. 105 €", "Edinburgh Castle 47 £, Urquhart 28 £, Tantallon 15 £"],
    ["ETA für 2", "40 £", "ca. 47 €"],
    ["Summe ohne Flug und Essen", "ca. 1.300 bis 1.700 €", "Richtwert"]
  ],

  emergency: [
    ["Notruf Polizei, Feuerwehr, Rettung", "999"],
    ["Notruf europaweit", "112"],
    ["Ärztlicher Rat, nicht dringend (NHS)", "111"],
    ["Polizei, nicht dringend", "101"]
  ],

  sources: [
    ["GOV.UK ETA", "https://www.gov.uk/eta/apply"],
    ["Urquhart Castle", "https://www.historicenvironment.scot/visit/all/urquhart-castle/plan-your-visit/"],
    ["Edinburgh Castle", "https://www.historicenvironment.scot/visit/all/edinburgh-castle/plan-your-visit/"],
    ["Tantallon Castle", "https://www.historicenvironment.scot/visit/all/tantallon-castle/plan-your-visit/"],
    ["Edinburgh Visitor Levy", "https://www.edinburgh.gov.uk/news/article/14452/edinburgh-visitor-levy-comes-into-effect"],
    ["Glasgow Umweltzone", "https://www.glasgow.gov.uk/article/3982/Glasgow-s-LEZ-Key-Information"],
    ["Edinburgh Umweltzone", "https://www.edinburgh.gov.uk/LEZ"],
    ["Traffic Scotland", "https://trafficscotland.org/"]
  ]
};
