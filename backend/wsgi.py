# -*- coding: utf-8 -*-
"""
Punkt wejścia WSGI dla PythonAnywhere.
W PythonAnywhere w pliku WSGI ustaw ścieżkę do tego katalogu, np.:
    import sys
    path = '/home/TWOJA_NAZWA/cyklia/backend'
    if path not in sys.path:
        sys.path.append(path)
    from wsgi import application
"""
import os
import database as db
import seed as seed_data

db.init_db()
seed_data.seed()

from app import app as application  # noqa: E402

if __name__ == "__main__":
    application.run(host="127.0.0.1", port=5000)
