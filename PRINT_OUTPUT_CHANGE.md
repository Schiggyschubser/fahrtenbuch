# Getrennte Ausgabe von Antrag und Fahrtentabellen ab 1.0.16

Die Druckansicht bietet unter **Ausgabe für PDF und Druck** zwei Ausgaben:

- **Antrag · Hochformat**: nur die beiden Antragsseiten, optional mit Unterschrift.
- **Fahrtentabellen · Querformat**: nur die Fahrten des gewählten Monats,
  Seitenzählung ab 1, mit der bisherigen Spaltenauswahl und Seiteneinteilung.

Beide Teile jeweils mit dem zugehörigen Druckknopf als PDF speichern oder
drucken. Auch der Browser-Druckbefehl enthält nur den ausgewählten Teil.
Für beidseitigen Druck mit seitlichem Umblättern beim Antrag die lange Kante
und bei den Tabellen die kurze Kante wählen. Die App zeigt den passenden
Hinweis; die Einstellung selbst wird im Druckdialog vorgenommen.

Die bisherige gespeicherte Voreinstellung für den Antrag bestimmt weiterhin
die anfängliche Auswahl. In den Einstellungen heißt sie jetzt
**Antrag in der Druckansicht vorauswählen**. Vorhandene Antragsdaten,
Unterschriften und die Datumsermittlung in Europe/Berlin bleiben erhalten.
Es gibt keine Datenbankmigration.

## Prüfung

Die Browsertests prüfen PDF-Seitenzahl und A4-Ausrichtung, getrennte Ausgaben,
Druckknöpfe, Unterschrift, Berlin-Ausgabedatum, Seitenzählung, lange Bemerkungen
und mobile Ansichten. Ein echter Duplex-Probedruck erfolgt am verwendeten
Drucker. Beispiele im Testlauf enthalten ausschließlich synthetische Daten.

Update, Kurztest und Rollback: [RELEASE_NOTES.md](RELEASE_NOTES.md).
Abhängigkeitskorrekturen: [SECURITY_DEPENDENCY_UPDATE.md](SECURITY_DEPENDENCY_UPDATE.md).
