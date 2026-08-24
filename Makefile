TARGET := kbrd

REMOTE_DIR := /var/www

.PHONY: build deploy

build:
	@printf "\033[47;30m %-60s \033[0m\n" " KBRD-WEB : compilation "
	./scripts/build.sh

deploy: build
	@printf "\033[47;30m %-60s \033[0m\n" " KBRD-WEB : déploiement "
	ssh $(TARGET) "mkdir -p $(REMOTE_DIR)"

	rsync -rv --delete \
		dist/ \
		$(TARGET):$(REMOTE_DIR)/

	@printf "\033[47;30m %-60s \033[0m\n" " KBRD-WEB : permissions "
	ssh $(TARGET) \
		"find $(REMOTE_DIR) -type d -exec chmod 755 {} \; && \
		 find $(REMOTE_DIR) -type f -exec chmod 644 {} \;"

	@printf "\033[47;30m %-60s \033[0m\n" " KBRD-WEB : déploiement terminé "curl
