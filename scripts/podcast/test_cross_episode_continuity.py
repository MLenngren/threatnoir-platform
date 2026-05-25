import sys
import unittest
from datetime import date as date_type
from pathlib import Path


# Allow importing sibling scripts (generate.py)
SCRIPT_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(SCRIPT_DIR))

import generate as podcast_generate  # noqa: E402


class TestCrossEpisodeContinuity(unittest.TestCase):
    def test_episode_when_phrase_same_day_morning_to_afternoon(self) -> None:
        cur = date_type.fromisoformat("2026-03-25")
        self.assertEqual(
            podcast_generate._episode_when_phrase(
                current_date=cur,
                current_edition="afternoon",
                covered_date=cur,
                covered_edition="morning",
            ),
            "this morning",
        )

    def test_episode_when_phrase_yesterday_afternoon(self) -> None:
        cur = date_type.fromisoformat("2026-03-25")
        prev = date_type.fromisoformat("2026-03-24")
        self.assertEqual(
            podcast_generate._episode_when_phrase(
                current_date=cur,
                current_edition="morning",
                covered_date=prev,
                covered_edition="afternoon",
            ),
            "yesterday afternoon",
        )

    def test_previously_covered_detects_cve_overlap(self) -> None:
        cur = date_type.fromisoformat("2026-03-25")
        today = [
            {
                "title": "Chrome fix for CVE-2026-12345 lands",
                "summary": "Google pushed an update addressing CVE-2026-12345.",
            }
        ]
        covered = [
            podcast_generate._CoveredTopic(
                title="Exploit in the wild for CVE-2026-12345",
                summary="Researchers saw attacks for CVE-2026-12345.",
                episode_date=date_type.fromisoformat("2026-03-24"),
                episode_edition="morning",
            )
        ]

        lines = podcast_generate._build_previously_covered_lines(
            today_articles=today,
            covered_topics=covered,
            current_date=cur,
            current_edition="morning",
        )
        self.assertEqual(len(lines), 1)
        self.assertIn("CVE-2026-12345", lines[0])
        self.assertIn("covered yesterday morning", lines[0])

    def test_previously_covered_detects_entity_overlap(self) -> None:
        cur = date_type.fromisoformat("2026-03-25")
        today = [
            {
                "title": "Trivy CI pipeline compromise expands",
                "summary": "More details emerged about the Trivy incident.",
            }
        ]
        covered = [
            podcast_generate._CoveredTopic(
                title="Trivy supply chain compromise hits CI",
                summary="Initial reporting on the Trivy issue.",
                episode_date=date_type.fromisoformat("2026-03-24"),
                episode_edition="afternoon",
            )
        ]

        lines = podcast_generate._build_previously_covered_lines(
            today_articles=today,
            covered_topics=covered,
            current_date=cur,
            current_edition="morning",
        )
        self.assertEqual(len(lines), 1)
        self.assertIn("Trivy", lines[0])
        self.assertIn("covered yesterday afternoon", lines[0])

    def test_previously_covered_detects_title_similarity(self) -> None:
        cur = date_type.fromisoformat("2026-03-25")
        today = [
            {
                "title": "TeamPCP hacks Checkmarx GitHub Actions",
                "summary": "Attackers targeted CI workflows.",
            }
        ]
        covered = [
            podcast_generate._CoveredTopic(
                title="Checkmarx GitHub Actions hacked by TeamPCP",
                summary="Earlier story with the same core nouns.",
                episode_date=date_type.fromisoformat("2026-03-23"),
                episode_edition="morning",
            )
        ]

        lines = podcast_generate._build_previously_covered_lines(
            today_articles=today,
            covered_topics=covered,
            current_date=cur,
            current_edition="morning",
        )
        self.assertEqual(len(lines), 1)
        self.assertIn("TeamPCP", lines[0])

    def test_previously_covered_empty_when_no_overlap(self) -> None:
        cur = date_type.fromisoformat("2026-03-25")
        today = [{"title": "New ransomware campaign", "summary": "Totally new."}]
        covered = [
            podcast_generate._CoveredTopic(
                title="Unrelated policy update",
                summary="Nothing to do with ransomware.",
                episode_date=date_type.fromisoformat("2026-03-24"),
                episode_edition="morning",
            )
        ]

        lines = podcast_generate._build_previously_covered_lines(
            today_articles=today,
            covered_topics=covered,
            current_date=cur,
            current_edition="morning",
        )
        self.assertEqual(lines, [])


if __name__ == "__main__":
    raise SystemExit(unittest.main())
