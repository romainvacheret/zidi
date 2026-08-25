"""Simple PySide GUI for character search."""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Iterable

from ..db import DictionaryRepository


def _token_has_tone(text: str) -> bool:
    return any(char.isdigit() for char in text) or any(
        char in {"ā", "á", "ǎ", "à", "ē", "é", "ě", "è", "ī", "í", "ǐ", "ì", "ō", "ó", "ǒ", "ò", "ū", "ú", "ǔ", "ù", "ǖ", "ǘ", "ǚ", "ǜ"}
        for char in text
    )


def tone_only_pinyin(raw_pinyin: str) -> str:
    tokens = [token for token in raw_pinyin.split() if token]
    tone_tokens = [token for token in tokens if _token_has_tone(token)]
    if tone_tokens:
        return " ".join(tone_tokens)
    return raw_pinyin.strip()


@dataclass(frozen=True)
class CharacterCardData:
    character: str
    pinyin: str


def cards_from_search_results(rows: Iterable[tuple[str, str | None, str, str | None]]) -> list[CharacterCardData]:
    cards: list[CharacterCardData] = []
    for char, _gloss, pinyin_text, _codepoint in rows:
        cards.append(CharacterCardData(character=char, pinyin=tone_only_pinyin(pinyin_text)))
    return cards

def launch(db_file: str | Path) -> int:
    from PySide6 import QtCore, QtWidgets

    alignment = getattr(QtCore.Qt, "AlignmentFlag", QtCore.Qt)
    frame_shape = getattr(QtWidgets.QFrame, "Shape", QtWidgets.QFrame)
    frame_shadow = getattr(QtWidgets.QFrame, "Shadow", QtWidgets.QFrame)

    class CharacterCard(QtWidgets.QFrame):
        def __init__(self, data: CharacterCardData, parent: QtWidgets.QWidget | None = None) -> None:
            super().__init__(parent)
            self.setObjectName("CharacterCard")
            self.setFrameShape(frame_shape.StyledPanel)
            self.setFrameShadow(frame_shadow.Raised)

            layout = QtWidgets.QVBoxLayout(self)
            layout.setContentsMargins(16, 12, 16, 12)
            layout.setSpacing(6)

            character_label = QtWidgets.QLabel(data.character)
            character_label.setAlignment(alignment.AlignCenter)
            character_label.setObjectName("CharacterLabel")

            pinyin_label = QtWidgets.QLabel(data.pinyin)
            pinyin_label.setAlignment(alignment.AlignCenter)
            pinyin_label.setObjectName("PinyinLabel")

            layout.addWidget(character_label)
            layout.addWidget(pinyin_label)

    class DictionaryWindow(QtWidgets.QWidget):
        def __init__(self, db_file: str | Path) -> None:
            super().__init__()
            self.repository = DictionaryRepository(db_file)
            self.setWindowTitle("Cidian")
            self.resize(820, 640)

            root_layout = QtWidgets.QVBoxLayout(self)
            root_layout.setContentsMargins(20, 20, 20, 20)
            root_layout.setSpacing(14)

            search_row = QtWidgets.QHBoxLayout()
            search_row.setSpacing(10)

            self.search_input = QtWidgets.QLineEdit()
            self.search_input.setPlaceholderText("Search by character or pinyin")

            self.search_button = QtWidgets.QPushButton("Search")
            self.search_button.clicked.connect(self.perform_search)
            self.search_input.returnPressed.connect(self.perform_search)

            search_row.addWidget(self.search_input, 1)
            search_row.addWidget(self.search_button)

            self.results_host = QtWidgets.QWidget()
            self.results_layout = QtWidgets.QVBoxLayout(self.results_host)
            self.results_layout.setContentsMargins(0, 0, 0, 0)
            self.results_layout.setSpacing(12)
            self.results_layout.addStretch(1)

            scroll_area = QtWidgets.QScrollArea()
            scroll_area.setWidgetResizable(True)
            scroll_area.setFrameShape(frame_shape.NoFrame)
            scroll_area.setWidget(self.results_host)

            root_layout.addLayout(search_row)
            root_layout.addWidget(scroll_area, 1)

            self.setStyleSheet(
                """
                QWidget {
                    background: #f7f4ee;
                    color: #1e1b16;
                    font-family: system-ui;
                    font-size: 14px;
                }
                QLineEdit {
                    padding: 12px 14px;
                    border: 1px solid #c9c1b5;
                    border-radius: 10px;
                    background: white;
                }
                QPushButton {
                    padding: 12px 18px;
                    border: none;
                    border-radius: 10px;
                    background: #2f5d62;
                    color: white;
                    font-weight: 600;
                }
                QPushButton:hover {
                    background: #27494d;
                }
                #CharacterCard {
                    background: white;
                    border: 1px solid #ded6c8;
                    border-radius: 14px;
                }
                #CharacterLabel {
                    font-size: 36px;
                    font-weight: 700;
                }
                #PinyinLabel {
                    font-size: 18px;
                    color: #5d574f;
                }
                """
            )

        def closeEvent(self, event) -> None:  # type: ignore[override]
            self.repository.close()
            super().closeEvent(event)

        def perform_search(self) -> None:
            query = self.search_input.text().strip()
            results = cards_from_search_results(self.repository.search_characters(query))
            self._show_cards(results)

        def _show_cards(self, cards: list[CharacterCardData]) -> None:
            while self.results_layout.count():
                item = self.results_layout.takeAt(0)
                widget = item.widget()
                if widget is not None:
                    widget.deleteLater()

            if not cards:
                empty_label = QtWidgets.QLabel("No matching characters.")
                empty_label.setAlignment(alignment.AlignCenter)
                empty_label.setStyleSheet("color: #6d655b; padding: 24px;")
                self.results_layout.addWidget(empty_label)
            else:
                for card in cards:
                    self.results_layout.addWidget(CharacterCard(card))

            self.results_layout.addStretch(1)

    app = QtWidgets.QApplication.instance() or QtWidgets.QApplication([])
    window = DictionaryWindow(db_file)
    window.show()
    return app.exec()
