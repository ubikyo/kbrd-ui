TARGET := kbrd

REMOTE_DIR := /var/www

.PHONY: build deploy

build:
	@printf "\033[47;30m %-60s \033[0m\n" " KBRD-WEB : compilation "
	./build.sh

deploy: build
	@printf "\033[47;30m %-60s \033[0m\n" " KBRD-WEB : déploiement "
	ssh $(TARGET) "mkdir -p $(REMOTE_DIR)"

	rsync -av --delete \
		dist/ \
		$(TARGET):$(REMOTE_DIR)/

	@printf "\033[47;30m %-60s \033[0m\n" " KBRD-WEB : permissions "
	ssh $(TARGET) "chown -R kbrd:kbrd $(REMOTE_DIR) && chmod -R u=rwX,go=rX $(REMOTE_DIR)"