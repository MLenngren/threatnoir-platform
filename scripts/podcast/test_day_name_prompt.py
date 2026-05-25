import runpy
import unittest
from pathlib import Path


class TestPodcastDayNamePrompt(unittest.TestCase):
    def _load_generate_dialogue_module(self) -> dict[str, object]:
        mod_path = Path(__file__).resolve().parent / "generate_dialogue.py"
        return runpy.run_path(str(mod_path))

    def test_system_prompt_limits_day_name_to_once(self) -> None:
        mod = self._load_generate_dialogue_module()
        system_prompt = str(mod["SYSTEM_PROMPT"])
        self.assertIn("DAY NAME ANTI-REPETITION", system_prompt)
        self.assertIn("at most ONCE", system_prompt)

    def test_assembly_prompt_limits_day_name_to_once(self) -> None:
        mod = self._load_generate_dialogue_module()
        assembly_prompt = str(mod["ASSEMBLY_PROMPT"])
        self.assertIn("DAY NAME ANTI-REPETITION", assembly_prompt)
        self.assertIn("at most ONCE", assembly_prompt)
