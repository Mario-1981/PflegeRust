export const SAMPLE_SNAP_XML = `<?xml version="1.0" encoding="ISO-8859-1"?>
<!-- SNAP Pflegemanagement Export Version 8.4.2 (Legacy Windows build 2019-11) -->
<SNAP_EXPORT Erstellungsdatum="2026-10-31" LizenzInhaber="Ambulanter Pflegedienst Berlin-Nord" Software="SNAP.Pflege v8.4">
  <MANDANT MandantenNr="10" Bezeichnung="Zentrale Niederlassung" Ort="Berlin" />
  <PATIENTEN>
    <PATIENT>
      <KUND_NR>10091</KUND_NR>
      <NAME>Wagner</NAME>
      <VORNAME>Kurt</VORNAME>
      <GEB_DATUM>1936-07-22</GEB_DATUM>
      <GESCHLECHT>M</GESCHLECHT>
      <STRASSE>Schönhauser Allee</STRASSE>
      <HAUSNR>58</HAUSNR>
      <PLZ>10437</PLZ>
      <ORT>Berlin-Pankow</ORT>
      <TELEFON>030 4482910</TELEFON>
      <KASSE_NAME>AOK Nordost</KASSE_NAME>
      <KASSE_IK>108018007</KASSE_IK>
      <VERS_NR>W391829012</VERS_NR>
      <BEFREIT>J</BEFREIT>
      <PFL_STUFE_ALT>2</PFL_STUFE_ALT>
      <PFL_GRAD_NEU>3</PFL_GRAD_NEU>
      <PFL_GRAD_DATUM>2022-04-01</PFL_GRAD_DATUM>
      <TOUR_ID>TOUR-PANKOW-1</TOUR_ID>
      <ARZT_NAME>Dr. med. Steffen Krause</ARZT_NAME>
      <ARZT_TEL>030 4421990</ARZT_TEL>
      <NOTFALL_NAME>Monika Wagner</NOTFALL_NAME>
      <NOTFALL_BEZ>Tochter</NOTFALL_BEZ>
      <NOTFALL_TEL>0173 9988112</NOTFALL_TEL>
      <SCHLUESSEL_INFO>Schlüsselbund 28, Hängt im Schlüsselschrank</SCHLUESSEL_INFO>
      <DIAGNOSEN>
        <DIAGNOSE ICD="I63.9">Hirninfarkt, nicht näher bezeichnet</DIAGNOSE>
        <DIAGNOSE ICD="I10">Essentielle Hypertonie</DIAGNOSE>
      </DIAGNOSEN>
      <GEBUCHTE_LEISTUNGEN>
        <LEISTUNG>LK 01</LEISTUNG>
        <LEISTUNG>LK 04</LEISTUNG>
        <LEISTUNG>SGBV-04</LEISTUNG>
        <LEISTUNG>SGBV-06</LEISTUNG>
      </GEBUCHTE_LEISTUNGEN>
      <MEDIKAMENTE>
        <MEDIKAMENT Name="Marcumar 3mg" Wirkstoff="Phenprocoumon" Form="Tbl." M="0" MI="0" A="1" N="0" Arzt="Dr. Krause" />
        <MEDIKAMENT Name="Bisoprolol 5mg" Wirkstoff="Bisoprololfumarat" Form="Tbl." M="1" MI="0" A="0" N="0" Arzt="Dr. Krause" />
      </MEDIKAMENTE>
      <SIS_DOKU>
        <FELD Kategorie="Kognition">Voll orientiert, leichte Sprachverlangsamung nach Insult.</FELD>
        <FELD Kategorie="Mobilitaet">Hemiparese rechts, geht unsicher am Gehstock.</FELD>
        <FELD Kategorie="Krankheit">Gerinnungsselbstkontrolle (INR) durch Tochter, engmaschige RR-Messung.</FELD>
        <FELD Kategorie="Selbstversorgung">Benötigt Übernahme bei Ganzwaschung und Ankleiden.</FELD>
        <FELD Kategorie="Soziales">Tochter wohnt in der Nähe und unterstützt täglich abends.</FELD>
        <FELD Kategorie="Haushalt">Einkauf und Reinigung über Tochter und Pflegedienst.</FELD>
      </SIS_DOKU>
    </PATIENT>
    <PATIENT>
      <KUND_NR>10092</KUND_NR>
      <NAME>Fischer</NAME>
      <VORNAME>Renate</VORNAME>
      <GEB_DATUM>1942-12-05</GEB_DATUM>
      <GESCHLECHT>W</GESCHLECHT>
      <STRASSE>Danziger Straße</STRASSE>
      <HAUSNR>119</HAUSNR>
      <PLZ>10405</PLZ>
      <ORT>Berlin-Prenzlauer Berg</ORT>
      <TELEFON>030 4251992</TELEFON>
      <KASSE_NAME>Barmer</KASSE_NAME>
      <KASSE_IK>107419024</KASSE_IK>
      <VERS_NR>F281902847</VERS_NR>
      <BEFREIT>N</BEFREIT>
      <PFL_STUFE_ALT>1</PFL_STUFE_ALT>
      <PFL_GRAD_NEU>2</PFL_GRAD_NEU>
      <PFL_GRAD_DATUM>2023-01-15</PFL_GRAD_DATUM>
      <TOUR_ID>TOUR-PANKOW-1</TOUR_ID>
      <ARZT_NAME>Dr. med. Petra Neumann</ARZT_NAME>
      <ARZT_TEL>030 4210988</ARZT_TEL>
      <NOTFALL_NAME>Jörg Fischer</NOTFALL_NAME>
      <NOTFALL_BEZ>Sohn</NOTFALL_BEZ>
      <NOTFALL_TEL>0160 5544332</NOTFALL_TEL>
      <SCHLUESSEL_INFO>Klingeln bei Fischer, 3. Stock links</SCHLUESSEL_INFO>
      <DIAGNOSEN>
        <DIAGNOSE ICD="M81.9">Osteoporose, nicht näher bezeichnet</DIAGNOSE>
        <DIAGNOSE ICD="E11.9">Diabetes mellitus Typ 2</DIAGNOSE>
      </DIAGNOSEN>
      <GEBUCHTE_LEISTUNGEN>
        <LEISTUNG>LK 02</LEISTUNG>
        <LEISTUNG>LK 11</LEISTUNG>
        <LEISTUNG>SGBV-01</LEISTUNG>
        <LEISTUNG>SGBV-02</LEISTUNG>
      </GEBUCHTE_LEISTUNGEN>
      <MEDIKAMENTE>
        <MEDIKAMENT Name="Insulatard HM Penfill" Wirkstoff="Humaninsulin" Form="Injektion" M="12" MI="0" A="8" N="0" Arzt="Dr. Neumann" />
        <MEDIKAMENT Name="Alendronsäure 70mg" Wirkstoff="Alendronsäure" Form="Tbl." M="1" MI="0" A="0" N="0" Arzt="Dr. Neumann" />
      </MEDIKAMENTE>
      <SIS_DOKU>
        <FELD Kategorie="Kognition">Kognitiv unauffällig, gute Stimmung.</FELD>
        <FELD Kategorie="Mobilitaet">Vorsichtiges Gehen wegen Sturzangst nach Wirbelkörperfraktur.</FELD>
        <FELD Kategorie="Krankheit">Blutzuckermessung und Insulingabe durch Pflegedienst.</FELD>
        <FELD Kategorie="Selbstversorgung">Teilwäsche Oberkörper gelingt selbstständig, Hilfe bei Beinen und Rücken.</FELD>
        <FELD Kategorie="Soziales">Rege Kontakte mit Nachbarinnen im Haus.</FELD>
        <FELD Kategorie="Haushalt">Hilfe beim Kochen und schweren Arbeiten.</FELD>
      </SIS_DOKU>
    </PATIENT>
    <PATIENT>
      <KUND_NR>10093</KUND_NR>
      <NAME>Krause</NAME>
      <VORNAME>Manfred</VORNAME>
      <GEB_DATUM>1934-08-30</GEB_DATUM>
      <GESCHLECHT>M</GESCHLECHT>
      <STRASSE>Kollwitzstraße</STRASSE>
      <HAUSNR>32</HAUSNR>
      <PLZ>10405</PLZ>
      <ORT>Berlin-Prenzlauer Berg</ORT>
      <TELEFON>030 4410928</TELEFON>
      <KASSE_NAME>Techniker Krankenkasse (TK)</KASSE_NAME>
      <KASSE_IK>104491707</KASSE_IK>
      <VERS_NR>K992817264</VERS_NR>
      <BEFREIT>J</BEFREIT>
      <PFL_STUFE_ALT>3</PFL_STUFE_ALT>
      <PFL_GRAD_NEU>4</PFL_GRAD_NEU>
      <PFL_GRAD_DATUM>2022-10-01</PFL_GRAD_DATUM>
      <TOUR_ID>TOUR-PANKOW-1</TOUR_ID>
      <ARZT_NAME>Dr. med. Bernd Richter</ARZT_NAME>
      <ARZT_TEL>030 4402911</ARZT_TEL>
      <NOTFALL_NAME>Gerda Krause</NOTFALL_NAME>
      <NOTFALL_BEZ>Ehefrau</NOTFALL_BEZ>
      <NOTFALL_TEL>030 4410928</NOTFALL_TEL>
      <SCHLUESSEL_INFO>Ehefrau öffnet immer verlässlich</SCHLUESSEL_INFO>
      <DIAGNOSEN>
        <DIAGNOSE ICD="G30.1">Alzheimer-Krankheit mit spätem Beginn</DIAGNOSE>
        <DIAGNOSE ICD="R32">Nicht näher bezeichnete Harninkontinenz</DIAGNOSE>
      </DIAGNOSEN>
      <GEBUCHTE_LEISTUNGEN>
        <LEISTUNG>LK 01</LEISTUNG>
        <LEISTUNG>LK 04</LEISTUNG>
        <LEISTUNG>LK 07</LEISTUNG>
        <LEISTUNG>SGBV-04</LEISTUNG>
      </GEBUCHTE_LEISTUNGEN>
      <MEDIKAMENTE>
        <MEDIKAMENT Name="Memantin 20mg" Wirkstoff="Memantinhydrochlorid" Form="Tbl." M="1" MI="0" A="0" N="0" Arzt="Dr. Richter" />
        <MEDIKAMENT Name="Melperon 25mg" Wirkstoff="Melperonhydrochlorid" Form="Tbl." M="0" MI="0" A="0" N="1" Arzt="Dr. Richter" />
      </MEDIKAMENTE>
      <SIS_DOKU>
        <FELD Kategorie="Kognition">Schwere Demenz, zeitlich und örtlich desorientiert, Hinlauftendenz.</FELD>
        <FELD Kategorie="Mobilitaet">Unruhiges Wandern in der Wohnung, stolpergefährdet.</FELD>
        <FELD Kategorie="Krankheit">Vollständige Überwachung der Medikamenteneinnahme erforderlich.</FELD>
        <FELD Kategorie="Selbstversorgung">Vollständige Hilfebedürftigkeit bei allen Verrichtungen des täglichen Lebens.</FELD>
        <FELD Kategorie="Soziales">Ehefrau ist stark pflegebelastet, Entlastungsleistungen nutzen.</FELD>
        <FELD Kategorie="Haushalt">Komplette Übernahme durch Pflegedienst und hauswirtschaftliche Hilfen.</FELD>
      </SIS_DOKU>
    </PATIENT>
  </PATIENTEN>
  <TOUREN>
    <TOUR>
      <TOUR_ID>TOUR-PANKOW-1</TOUR_ID>
      <BEZEICHNUNG>Pankow &amp; Prenzlauer Berg Früh</BEZEICHNUNG>
      <SCHICHT>Frühdienst</SCHICHT>
      <FAHRER>MM</FAHRER>
    </TOUR>
  </TOUREN>
</SNAP_EXPORT>`;

export const SAMPLE_SNAP_CSV = `KUND_NR;NAME;VORNAME;GEB_DATUM;STRASSE;HAUSNR;PLZ;ORT;PFLEGEGRAD;KASSE;VERS_NR;TOUR_ID;LEISTUNGEN
10091;Wagner;Kurt;1936-07-22;Schönhauser Allee;58;10437;Berlin;3;AOK Nordost;W391829012;TOUR-PANKOW-1;LK 01+LK 04+SGBV-04+SGBV-06
10092;Fischer;Renate;1942-12-05;Danziger Straße;119;10405;Berlin;2;Barmer;F281902847;TOUR-PANKOW-1;LK 02+LK 11+SGBV-01+SGBV-02
10093;Krause;Manfred;1934-08-30;Kollwitzstraße;32;10405;Berlin;4;TK;K992817264;TOUR-PANKOW-1;LK 01+LK 04+LK 07+SGBV-04`;
