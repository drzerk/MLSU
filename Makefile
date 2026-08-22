.PHONY: help install-ref test test-ref test-ct test-web demo duress lint-ref

help:
	@echo "MLSU — common targets"
	@echo "  make install-ref   pip install the reference model"
	@echo "  make test          Python + C + TypeScript tests"
	@echo "  make test-ref      reference model unit tests"
	@echo "  make test-ct       C fold_select + Python cross-check"
	@echo "  make test-web      vitest (simulator crypto)"
	@echo "  make demo          walk the mechanism once"
	@echo "  make duress        coercion scenario once"

install-ref:
	python3 -m pip install -r reference/requirements.txt

test: test-ref test-ct test-web

test-ref:
	cd reference && python3 -m unittest discover -s tests -v

test-ct:
	$(MAKE) -C reference/ct_core check

test-web:
	npm test

demo:
	cd reference && python3 demo.py

duress:
	cd reference && python3 simulate_duress.py

lint-ref:
	python3 -m pyflakes reference/mlsu reference/tests reference/demo.py reference/simulate_duress.py reference/bench/timing.py reference/ct_core/crosscheck.py
