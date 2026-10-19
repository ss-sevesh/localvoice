import base64

import numpy as np

from scripts.mix_demo import RATE, add, marker_offset, reply_track, voice_level


def test_mix_clips_to_video_bounds_and_handles_early_audio():
    track = np.zeros(RATE // 2)
    add(track, np.ones(RATE), RATE, -0.25)
    assert np.all(track == 1)
    add(track, np.ones(RATE), RATE, 1)
    assert np.all(track == 1)


def test_interrupted_audio_is_cut_at_the_actual_stop_time():
    pcm = np.ones(RATE, dtype="<f4") * 0.2
    capture = {
        "started": 1000,
        "events": [
            {
                "type": "start",
                "id": 1,
                "at": 1100,
                "rate": RATE,
                "pcm": base64.b64encode(pcm.tobytes()).decode(),
            },
            {"type": "stop", "id": 1, "at": 1350},
        ],
    }
    track = reply_track(capture, 1)
    assert np.count_nonzero(track) == RATE // 4
    assert np.all(track[: RATE // 10] == 0)
    assert np.all(track[round(RATE * 0.35) :] == 0)
    assert np.isclose(voice_level(pcm).max(), 0.15)


def test_visual_marker_aligns_audio_to_the_actual_video_frame():
    lines = [
        "frame:0 pts:0 pts_time:0",
        "lavfi.signalstats.YAVG=10",
        "frame:1 pts:1 pts_time:0.04",
        "lavfi.signalstats.YAVG=235",
    ]
    assert np.isclose(marker_offset(lines, 0.06), -0.02)
    initial_white = [
        "frame:0 pts:0 pts_time:0",
        "lavfi.signalstats.YAVG=235",
        "frame:1 pts:1 pts_time:0.02",
        "lavfi.signalstats.YAVG=10",
    ]
    assert np.isclose(marker_offset(initial_white + lines[2:], 0.06), -0.02)
