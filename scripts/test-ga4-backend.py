"""Compile the actual application and run dependency-free measurement regression checks.

Uses existing Maven cache; never starts production services or downloads dependencies.
"""
from pathlib import Path
import os
import subprocess
import tempfile

root = Path(__file__).resolve().parents[1]
jars = sorted((Path.home() / '.m2' / 'repository').rglob('*.jar'))
if not jars:
    raise SystemExit('BLOCKED: Maven dependency cache is empty; run the normal API build first.')
with tempfile.TemporaryDirectory(prefix='goihue-ga4-java-') as directory:
    target = Path(directory)
    classpath = os.pathsep.join(str(p) for p in jars)
    sources = sorted((root / 'apps/api/src/main/java').rglob('*.java'))
    sources += sorted((root / 'apps/api/src/test/java').rglob('*MeasurementTest.java'))
    args = ['-encoding', 'UTF-8', '-cp', classpath, '-d', str(target / 'classes')] + [str(p) for p in sources]
    argfile = target / 'compile.args'
    argfile.write_text('\n'.join('"' + str(a).replace('\\', '/') + '"' for a in args), encoding='utf-8')
    subprocess.run(['javac', '@' + str(argfile)], check=True, cwd=root)
    subprocess.run(['java', '-ea', '-cp', str(target / 'classes') + os.pathsep + classpath,
                    'vn.goihue.CommerceMeasurementTest'], check=True, cwd=root)
