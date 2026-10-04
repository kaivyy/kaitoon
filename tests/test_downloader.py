import os
import zipfile
import tempfile
import pytest
from unittest.mock import MagicMock, patch
from kaitoon.downloader import (
    sanitize_filename,
    package_chapter_cbz,
)


def test_sanitize_filename():
    assert sanitize_filename("Solo Leveling") == "Solo_Leveling"
    assert sanitize_filename("Spy x Family: Code White / Zero") == "Spy_x_Family_Code_White__Zero"
    assert sanitize_filename('Bad <File> Name: "Test"?*|') == "Bad_File_Name_Test"
    assert sanitize_filename("  Trim Spaces  ") == "Trim_Spaces"


def test_package_chapter_cbz():
    mock_client = MagicMock()
    mock_client.get_chapter_detail.return_value = {
        "data": {
            "manga_id": "mock-manga-1",
            "chapter_number": 5,
        }
    }
    mock_client.get_chapter_image_urls.return_value = []
    mock_client.web_url = "https://11.shinigami.asia"

    with tempfile.TemporaryDirectory() as tmp_dir:
        cbz_path = package_chapter_cbz(
            mock_client,
            "mock-ch-1",
            manga_title="Test Manga",
            output_dir=tmp_dir,
            max_workers=1,
        )
        assert os.path.exists(cbz_path)
        assert cbz_path.endswith(".cbz")
        assert zipfile.is_zipfile(cbz_path)
        assert os.path.basename(cbz_path) == "Test_Manga_Ch_5.cbz"


def test_package_chapter_cbz_with_images():
    mock_client = MagicMock()
    mock_client.get_chapter_detail.return_value = {
        "data": {
            "manga_id": "mock-manga-2",
            "chapter_number": 12.5,
        }
    }
    mock_client.get_chapter_image_urls.return_value = [
        "https://cdn.example.com/img1.jpg",
        "https://cdn.example.com/img2.png",
    ]
    mock_client.web_url = "https://11.shinigami.asia"

    with tempfile.TemporaryDirectory() as tmp_dir:
        # Mock download_image to create dummy files
        def fake_download_image(url, save_path, referer=None):
            with open(save_path, "wb") as f:
                f.write(b"FAKE_IMAGE_DATA")
            return True

        with patch("kaitoon.downloader.download_image", side_effect=fake_download_image):
            cbz_path = package_chapter_cbz(
                mock_client,
                "mock-ch-12-5",
                manga_title="Special: Manga / Title",
                output_dir=tmp_dir,
                max_workers=2,
            )

        assert os.path.exists(cbz_path)
        assert cbz_path.endswith(".cbz")
        assert zipfile.is_zipfile(cbz_path)
        assert os.path.basename(cbz_path) == "Special_Manga__Title_Ch_12.5.cbz"

        # Verify archive content
        with zipfile.ZipFile(cbz_path, "r") as zf:
            namelist = sorted(zf.namelist())
            assert "001.jpg" in namelist
            assert "002.png" in namelist
            # Verify file content inside archive
            content = zf.read("001.jpg")
            assert content == b"FAKE_IMAGE_DATA"


def test_package_chapter_cbz_edge_cases():
    mock_client = MagicMock()
    mock_client.get_chapter_detail.return_value = {
        "data": {
            "manga_id": "mock-manga-long",
            "chapter_number": 0,
        }
    }
    mock_client.get_chapter_image_urls.return_value = []
    mock_client.web_url = "https://11.shinigami.asia"

    with tempfile.TemporaryDirectory() as tmp_dir:
        # Long title over 40 chars
        long_title = "A" * 60
        cbz_path = package_chapter_cbz(
            mock_client,
            "mock-ch-0",
            manga_title=long_title,
            output_dir=tmp_dir,
            max_workers=1,
        )
        assert os.path.exists(cbz_path)
        base = os.path.basename(cbz_path)
        assert base.startswith("A" * 40)
        assert base.endswith("_Ch_0.cbz")

        # Empty or symbol-only title fallback
        cbz_path_fallback = package_chapter_cbz(
            mock_client,
            "mock-ch-empty",
            manga_title="???///***",
            output_dir=tmp_dir,
            max_workers=1,
        )
        assert os.path.basename(cbz_path_fallback) == "Manga_Ch_0.cbz"


def test_package_chapter_cbz_ignores_non_image_files():
    mock_client = MagicMock()
    mock_client.get_chapter_detail.return_value = {
        "data": {
            "manga_id": "mock-manga-filter",
            "chapter_number": 1,
        }
    }
    mock_client.get_chapter_image_urls.return_value = []
    mock_client.web_url = "https://11.shinigami.asia"

    with tempfile.TemporaryDirectory() as tmp_dir:
        def fake_download_chapter(client, ch_id, output_dir=None, max_workers=5):
            target = os.path.join(output_dir, "manga_mock-man_ch_1")
            os.makedirs(target, exist_ok=True)
            with open(os.path.join(target, "001.jpg"), "wb") as f:
                f.write(b"IMG_DATA")
            with open(os.path.join(target, "metadata.json"), "w") as f:
                f.write('{"info": "test"}')
            with open(os.path.join(target, "readme.txt"), "w") as f:
                f.write("test note")
            return target

        with patch("kaitoon.downloader.download_chapter", side_effect=fake_download_chapter):
            cbz_path = package_chapter_cbz(
                mock_client,
                "mock-ch-filter",
                manga_title="Filter Test",
                output_dir=tmp_dir,
            )

        with zipfile.ZipFile(cbz_path, "r") as zf:
            files = zf.namelist()
            assert "001.jpg" in files
            assert "metadata.json" not in files
            assert "readme.txt" not in files

