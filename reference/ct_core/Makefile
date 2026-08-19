# MLSU ct_core — C build

CC ?= cc
CFLAGS ?= -std=c11 -O2 -Wall -Wextra -Wpedantic

all: mlsu_ct_cli test_mlsu_ct

mlsu_ct_cli: mlsu_ct.c mlsu_ct_cli.c mlsu_ct.h
	$(CC) $(CFLAGS) -o $@ mlsu_ct.c mlsu_ct_cli.c

test_mlsu_ct: mlsu_ct.c test_mlsu_ct.c mlsu_ct.h
	$(CC) $(CFLAGS) -o $@ mlsu_ct.c test_mlsu_ct.c

# Build, run unit tests, then cross-check against the Python reference.
check: test_mlsu_ct mlsu_ct_cli
	./test_mlsu_ct
	python3 crosscheck.py

test: test_mlsu_ct
	./test_mlsu_ct

clean:
	rm -f mlsu_ct_cli test_mlsu_ct

.PHONY: all check test clean
