package com.pipeline.wpe.service;

import org.springframework.web.multipart.MultipartFile;

public interface FileStorageService {
    String storeAvatar(MultipartFile file);
}

